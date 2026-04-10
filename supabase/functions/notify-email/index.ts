import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'

const SITE_NAME = "gruzli"
const SENDER_DOMAIN = "noty.gruzli.official"
const FROM_DOMAIN = "noty.gruzli.official"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
}

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function getSupabase() {
  const url = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(url, key)
}

async function getUserEmail(supabase: any, userId: string): Promise<string | null> {
  const { data } = await supabase.auth.admin.getUserById(userId)
  return data?.user?.email || null
}

async function enqueueEmail(
  supabase: any,
  templateName: string,
  recipientEmail: string,
  templateData: Record<string, any>,
  idempotencyKey: string,
) {
  const template = TEMPLATES[templateName]
  if (!template) {
    console.error('Template not found:', templateName)
    return
  }

  // Check suppression
  const { data: suppressed } = await supabase
    .from('suppressed_emails')
    .select('id')
    .eq('email', recipientEmail.toLowerCase())
    .maybeSingle()
  if (suppressed) {
    console.log('Email suppressed:', recipientEmail)
    return
  }

  // Get or create unsubscribe token
  const normalizedEmail = recipientEmail.toLowerCase()
  let unsubscribeToken: string

  const { data: existingToken } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (existingToken && !existingToken.used_at) {
    unsubscribeToken = existingToken.token
  } else if (!existingToken) {
    unsubscribeToken = generateToken()
    await supabase.from('email_unsubscribe_tokens').upsert(
      { token: unsubscribeToken, email: normalizedEmail },
      { onConflict: 'email', ignoreDuplicates: true }
    )
    const { data: stored } = await supabase
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', normalizedEmail)
      .maybeSingle()
    if (stored) unsubscribeToken = stored.token
  } else {
    console.log('Email unsubscribed:', normalizedEmail)
    return
  }

  const html = await renderAsync(React.createElement(template.component, templateData))
  const plainText = await renderAsync(React.createElement(template.component, templateData), { plainText: true })
  const resolvedSubject = typeof template.subject === 'function' ? template.subject(templateData) : template.subject
  const messageId = crypto.randomUUID()

  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: recipientEmail,
    status: 'pending',
  })

  await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: recipientEmail,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: resolvedSubject,
      html,
      text: plainText,
      purpose: 'transactional',
      label: templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })

  console.log('Email enqueued:', templateName, recipientEmail)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    const { type, ...data } = body
    const supabase = await getSupabase()

    if (type === 'new_message') {
      // Notify all conversation participants except sender
      const { conversation_id, sender_id, text } = data

      const { data: participants } = await supabase
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversation_id)
        .neq('user_id', sender_id)

      if (!participants?.length) {
        return new Response(JSON.stringify({ ok: true, reason: 'no_recipients' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      // Get sender name
      const { data: senderProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('user_id', sender_id)
        .single()

      for (const p of participants) {
        const email = await getUserEmail(supabase, p.user_id)
        if (!email) continue

        await enqueueEmail(
          supabase,
          'new-message-notification',
          email,
          {
            senderName: senderProfile?.full_name || 'Пользователь',
            messageText: text || 'Новое сообщение',
          },
          `msg-${conversation_id}-${sender_id}-${Date.now()}`,
        )
      }
    } else if (type === 'new_job_response') {
      // Notify dispatcher about new response
      const { job_id, worker_id, message } = data

      const { data: job } = await supabase
        .from('jobs')
        .select('title, dispatcher_id')
        .eq('id', job_id)
        .single()

      if (!job) {
        return new Response(JSON.stringify({ ok: true, reason: 'job_not_found' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const [dispatcherEmail, workerProfile] = await Promise.all([
        getUserEmail(supabase, job.dispatcher_id),
        supabase.from('profiles').select('full_name').eq('user_id', worker_id).single(),
      ])

      if (dispatcherEmail) {
        await enqueueEmail(
          supabase,
          'job-response-notification',
          dispatcherEmail,
          {
            workerName: workerProfile?.data?.full_name || 'Работник',
            jobTitle: job.title,
            message: message || undefined,
          },
          `job-resp-${job_id}-${worker_id}`,
        )
      }
    } else if (type === 'new_job') {
      // This is triggered by the database trigger already (send-push).
      // For email: notify all workers. But this would be bulk/marketing.
      // Instead, we skip this — job notifications go via push only.
      // Individual job email is only sent on explicit request.
      console.log('new_job email skipped — use push notifications')
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('notify-email error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
