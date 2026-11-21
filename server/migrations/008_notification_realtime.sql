CREATE OR REPLACE FUNCTION notify_gruzli_notification_created()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_notify(
    'gruzli_notification_created',
    json_build_object(
      'recipientId', NEW.recipient_id,
      'notificationId', NEW.id
    )::text
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notifications_realtime_insert ON notifications;
CREATE TRIGGER notifications_realtime_insert
AFTER INSERT ON notifications
FOR EACH ROW
EXECUTE FUNCTION notify_gruzli_notification_created();
