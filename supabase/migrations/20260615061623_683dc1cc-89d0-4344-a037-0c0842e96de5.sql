
-- Forwarder: move pending rows from email_notifications_outbox into the
-- Lovable Emails pgmq queue, so existing receipts (transactions trigger and
-- QR Pay/POS/checkout flows that write to outbox) are actually delivered.

CREATE OR REPLACE FUNCTION public.dispatch_outbox_to_pgmq(p_limit int DEFAULT 50)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_sender_domain text := 'notify.openpy.space';
  v_from text := 'OpenPay Receipts <receipts@notify.openpy.space>';
  v_html text;
  v_count int := 0;
BEGIN
  FOR r IN
    SELECT id, to_email, subject, body, payload, transaction_id
    FROM public.email_notifications_outbox
    WHERE status = 'pending'
      AND to_email IS NOT NULL
      AND to_email !~ '@openpay\.local$'   -- skip synthetic Pi addresses
      AND to_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
    ORDER BY created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    v_html :=
      '<!doctype html><html><body style="margin:0;background:#f5f7fa;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2c2e2f;">' ||
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:24px 0;">' ||
      '<tr><td align="center">' ||
      '<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e6ebf0;">' ||
      '<tr><td style="background:#003087;padding:20px 28px;color:#ffffff;font-weight:700;font-size:18px;">OpenPay</td></tr>' ||
      '<tr><td style="padding:24px 28px 8px;font-size:18px;font-weight:700;color:#2c2e2f;">' || replace(coalesce(r.subject,'Your receipt'), '<','&lt;') || '</td></tr>' ||
      '<tr><td style="padding:8px 28px 24px;font-size:14px;line-height:1.55;color:#4a4e51;white-space:pre-wrap;">' || replace(coalesce(r.body,''), '<','&lt;') || '</td></tr>' ||
      '<tr><td style="padding:16px 28px 24px;border-top:1px solid #eef2f6;font-size:12px;color:#6c7378;">Thank you for using OpenPay. This is an automated receipt — please keep it for your records.</td></tr>' ||
      '</table></td></tr></table></body></html>';

    BEGIN
      PERFORM public.enqueue_email(
        'transactional_emails',
        jsonb_build_object(
          'to', r.to_email,
          'from', v_from,
          'sender_domain', v_sender_domain,
          'subject', r.subject,
          'html', v_html,
          'text', r.body,
          'purpose', 'transactional',
          'label', COALESCE(r.payload->>'kind', 'openpay-receipt'),
          'idempotency_key', 'outbox-' || r.id::text,
          'message_id', 'outbox-' || r.id::text
        )
      );

      UPDATE public.email_notifications_outbox
      SET status='sent', sent_at=now(), attempts=attempts+1, last_error=NULL
      WHERE id = r.id;
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      UPDATE public.email_notifications_outbox
      SET attempts=attempts+1,
          last_error=SQLERRM,
          status = CASE WHEN attempts+1 >= 5 THEN 'failed' ELSE 'pending' END
      WHERE id = r.id;
    END;
  END LOOP;

  -- Suppress unsendable rows (synthetic / invalid addresses) so the outbox stays clean
  UPDATE public.email_notifications_outbox
  SET status='failed', last_error='unsendable recipient', attempts=attempts+1
  WHERE status='pending'
    AND (to_email IS NULL OR to_email ~ '@openpay\.local$' OR to_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$');

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dispatch_outbox_to_pgmq(int) TO service_role;

-- Schedule every 30 seconds (independent of process-email-queue's 5s pgmq cron)
DO $$
BEGIN
  PERFORM cron.unschedule('dispatch-outbox-to-pgmq');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'dispatch-outbox-to-pgmq',
  '30 seconds',
  $$SELECT public.dispatch_outbox_to_pgmq(100);$$
);
