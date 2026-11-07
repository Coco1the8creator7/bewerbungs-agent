"""Transactional encrypted email outbox. No addresses or tokens in logs."""
import json, os, uuid, smtplib, ssl
from datetime import datetime, timezone, timedelta
from email.message import EmailMessage
from cryptography.fernet import Fernet

def queue_mail(con,to,subject,body):
    payload=Fernet(os.environ["CAREER_AUTH_TOTP_KEY"].encode()).encrypt(json.dumps([to,subject,body]).encode())
    # Verification/reset links must not be delivered after their shortest 30-minute lifetime.
    ttl=timedelta(minutes=25) if "reset?token=" in body else timedelta(hours=23)
    con.execute("INSERT INTO career_auth.mail_outbox(id,payload,expires_at) VALUES(%s,%s,%s)",
                (uuid.uuid4(),payload,datetime.now(timezone.utc)+ttl))
def send(to,subject,body):
    message=EmailMessage()
    message["From"]=os.environ["CAREER_AUTH_MAIL_FROM"];message["To"]=to;message["Subject"]=subject
    message["Message-ID"]="<"+uuid.uuid4().hex+"@careeragency.ch>"
    message.set_content(body)
    with smtplib.SMTP(os.environ["CAREER_AUTH_SMTP_HOST"],int(os.getenv("CAREER_AUTH_SMTP_PORT","587")),timeout=15) as smtp:
        smtp.starttls(context=ssl.create_default_context())
        smtp.login(os.environ["CAREER_AUTH_SMTP_USER"],os.environ["CAREER_AUTH_SMTP_PASS"])
        smtp.send_message(message)
def deliver_batch(connection,send_message=send,maximum=20):
    sent=failed=0
    for _ in range(maximum):
        with connection() as con:
            row=con.execute("""SELECT id,payload,attempts FROM career_auth.mail_outbox
                WHERE delivered_at IS NULL AND attempts<8 AND expires_at>now() AND next_attempt_at<=now()
                ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1""").fetchone()
            if not row: break
            try:
                payload=json.loads(Fernet(os.environ["CAREER_AUTH_TOTP_KEY"].encode()).decrypt(bytes(row["payload"])))
                send_message(*payload)
            except Exception:
                # Retry metadata only. SMTP exceptions can contain addresses and credentials.
                con.execute("""UPDATE career_auth.mail_outbox SET attempts=attempts+1,last_error='delivery_failed',
                    next_attempt_at=now()+(%s*interval '1 second') WHERE id=%s""",(min(3600,30*2**row["attempts"]),row["id"]))
                failed+=1
            else:
                con.execute("UPDATE career_auth.mail_outbox SET delivered_at=now(),payload=''::bytea,last_error=NULL WHERE id=%s",(row["id"],))
                sent+=1
    return {"sent":sent,"failed":failed}
def main():
    from .app import db
    result=deliver_batch(db)
    print(json.dumps(result))
    raise SystemExit(1 if result["failed"] else 0)
if __name__=="__main__":main()
