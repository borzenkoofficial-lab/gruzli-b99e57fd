export const FREE_WEEKLY_COMPLETED_JOB_LIMIT = 3;

export class WorkerResponseError extends Error {
  constructor(code, status, message) {
    super(message);
    this.name = "WorkerResponseError";
    this.code = code;
    this.status = status;
  }
}

function fail(code, status, message) {
  throw new WorkerResponseError(code, status, message);
}

export async function submitWorkerResponse({ db, jobId, workerId, message }) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(jobId))) {
    fail("INVALID_JOB_ID", 400, "Некорректный идентификатор заявки.");
  }
  const client = await db.connect();
  let transactionOpen = false;

  try {
    await client.query("BEGIN");
    transactionOpen = true;

    // Lock the job first. Every workflow that mutates a job must use this
    // lock order before taking worker- or conversation-scoped locks.
    const jobResult = await client.query(
      "SELECT id, title, dispatcher_id, status FROM jobs WHERE id = $1 FOR UPDATE",
      [jobId],
    );
    const job = jobResult.rows[0];
    if (!job) fail("JOB_NOT_FOUND", 404, "Заявка не найдена.");
    if (!job.dispatcher_id || !["active", "open"].includes(job.status)) {
      fail("JOB_NOT_AVAILABLE", 409, "Заявка сейчас недоступна для отклика.");
    }

    // Serialize this worker's submissions across different jobs so parallel
    // requests cannot both pass the weekly free-tier limit.
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      ["worker-response:" + workerId],
    );

    const profileResult = await client.query(
      "SELECT is_premium, full_name FROM profiles WHERE user_id = $1 FOR UPDATE",
      [workerId],
    );
    const profile = profileResult.rows[0];
    if (!profile) fail("WORKER_PROFILE_NOT_FOUND", 404, "Профиль исполнителя не найден.");

    const weeklyResult = await client.query(
      "SELECT count(DISTINCT job_id)::int AS completed_count FROM job_responses " +
      "WHERE worker_id = $1 AND worker_status = 'completed' " +
      "AND work_finished_at >= date_trunc('week', now()) " +
      "AND work_finished_at < date_trunc('week', now()) + interval '1 week'",
      [workerId],
    );
    const weeklyCompletedJobs = weeklyResult.rows[0]?.completed_count ?? 0;
    if (!profile.is_premium && weeklyCompletedJobs >= FREE_WEEKLY_COMPLETED_JOB_LIMIT) {
      fail(
        "WEEKLY_LIMIT_REACHED",
        429,
        "Достигнут недельный лимит выполненных заказов. Оформите Premium для продолжения.",
      );
    }

    const duplicateResult = await client.query(
      "SELECT * FROM job_responses WHERE job_id = $1 AND worker_id = $2 " +
      "AND status IN ('pending','accepted') LIMIT 1",
      [job.id, workerId],
    );
    const isNewResponse = duplicateResult.rowCount === 0;
    const suppliedMessage = typeof message === "string" ? message.trim() : "";
    const responseMessage = (suppliedMessage || (
      "Здравствуйте! Откликнулся на заказ «" + job.title + "». Готов обсудить детали и условия."
    )).slice(0, 2000);

    let response;
    if (isNewResponse) {
      const inserted = await client.query(
        "INSERT INTO job_responses (job_id, worker_id, message, status, worker_status) " +
        "VALUES ($1,$2,$3,'pending','ready') RETURNING *",
        [job.id, workerId, responseMessage],
      );
      response = inserted.rows[0];
    } else {
      response = duplicateResult.rows[0];
    }

    // Lock the normalized participant pair to prevent two simultaneous
    // submissions from creating duplicate direct conversations.
    const pairKey = [workerId, job.dispatcher_id].sort().join(":");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      ["direct-chat:" + pairKey],
    );

    const blocked = await client.query(
      "SELECT 1 FROM blocked_users WHERE " +
      "(blocker_id = $1 AND blocked_id = $2) OR (blocker_id = $2 AND blocked_id = $1) LIMIT 1",
      [workerId, job.dispatcher_id],
    );
    if (blocked.rowCount) {
      fail("CHAT_BLOCKED", 403, "Нельзя начать диалог: один из участников заблокировал другого.");
    }

    const existingConversation = await client.query(
      "SELECT c.id FROM conversations c " +
      "JOIN conversation_participants worker ON worker.conversation_id = c.id AND worker.user_id = $1 " +
      "JOIN conversation_participants dispatcher ON dispatcher.conversation_id = c.id AND dispatcher.user_id = $2 " +
      "WHERE c.is_group = false " +
      "AND (SELECT count(*) FROM conversation_participants members WHERE members.conversation_id = c.id) = 2 " +
      "ORDER BY c.created_at ASC LIMIT 1 FOR UPDATE OF c",
      [workerId, job.dispatcher_id],
    );

    let conversationId = existingConversation.rows[0]?.id;
    if (!conversationId) {
      const dispatcherProfile = await client.query(
        "SELECT full_name FROM profiles WHERE user_id = $1",
        [job.dispatcher_id],
      );
      const conversationTitle = dispatcherProfile.rows[0]?.full_name || job.title;
      const created = await client.query(
        "INSERT INTO conversations (title, is_group, job_id, created_by) VALUES ($1,false,$2,$3) RETURNING id",
        [conversationTitle, job.id, workerId],
      );
      conversationId = created.rows[0].id;
      await client.query(
        "INSERT INTO conversation_participants (conversation_id, user_id) VALUES ($1,$2),($1,$3)",
        [conversationId, workerId, job.dispatcher_id],
      );
    }

    let chatMessage = null;
    if (isNewResponse) {
      const insertedMessage = await client.query(
        "INSERT INTO messages (conversation_id, sender_id, text, message_type) " +
        "VALUES ($1,$2,$3,'text') " +
        "RETURNING id, conversation_id, sender_id, text, media_url, message_type, reply_to_id, created_at",
        [conversationId, workerId, responseMessage],
      );
      chatMessage = { ...insertedMessage.rows[0], sender_name: profile.full_name };
      await client.query(
        "UPDATE conversation_participants SET last_read_at = now() " +
        "WHERE conversation_id = $1 AND user_id = $2",
        [conversationId, workerId],
      );
    }

    if (isNewResponse) {
      await client.query(
        "INSERT INTO app_audit_log (actor_user_id, action, entity_type, entity_id, metadata) " +
        "VALUES ($1,'worker.response_submitted','job_response',$2,$3::jsonb)",
        [workerId, response.id, JSON.stringify({ jobId: job.id, dispatcherId: job.dispatcher_id, conversationId })],
      );
    }

    await client.query("COMMIT");
    transactionOpen = false;

    return {
      response,
      conversationId,
      dispatcherId: job.dispatcher_id,
      message: chatMessage,
      existing: !isNewResponse,
      weeklyCompletedJobs,
    };
  } catch (error) {
    if (transactionOpen) await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
