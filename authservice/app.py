"""Career.Agency auth API. Requires verified Postgres, SMTP and reverse proxy.
No public deployment until all integration tests and direct URL access checks pass.
"""
import os, uuid, smtplib, secrets, hashlib, hmac
from datetime import timedelta, datetime, timezone
from email.message import EmailMessage
from urllib.parse import quote
import psycopg, pyotp
from psycopg.rows import dict_row
from cryptography.fernet import Fernet
from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr, Field
from auth.security import canonical_email,hash_password,password_matches,new_bearer_secret,digest_bearer_secret,expiry_for_session,AccountState,permitted_area

app=FastAPI(openapi_url=None,docs_url=None,redoc_url=None)
COOKIE="ca_session"
def now(): return datetime.now(timezone.utc)
def db(): return psycopg.connect(os.environ["CAREER_AUTH_DATABASE_URL"],row_factory=dict_row)
from .outbox import queue_mail
def origin(): return os.environ["CAREER_AUTH_PUBLIC_ORIGIN"].rstrip("/")
@app.middleware("http")
async def request_protection(request,call_next):
    if request.method not in ("GET","HEAD","OPTIONS") and request.headers.get("origin")!=origin():
        return JSONResponse({"detail":"Request rejected"},status_code=403)
    response=await call_next(request)
    response.headers["Cache-Control"]="no-store"
    response.headers["X-Content-Type-Options"]="nosniff"
    response.headers["Referrer-Policy"]="no-referrer"
    return response
def limit(action,identity,maximum=8,seconds=900):
    # Separate committed transaction: failed auth must never undo attempt counters.
    key=hashlib.sha256((action+":"+identity).encode()).digest()
    with db() as con:
        con.execute("""INSERT INTO career_auth.rate_counters(key,window_until,attempts)
            VALUES(%s,now()+(%s*interval '1 second'),1)
            ON CONFLICT(key) DO UPDATE SET
            attempts=CASE WHEN career_auth.rate_counters.window_until<=now() THEN 1
            ELSE career_auth.rate_counters.attempts+1 END,
            window_until=CASE WHEN career_auth.rate_counters.window_until<=now()
            THEN now()+(%s*interval '1 second') ELSE career_auth.rate_counters.window_until END""",
            (key,seconds,seconds))
        n=con.execute("SELECT attempts FROM career_auth.rate_counters WHERE key=%s",(key,)).fetchone()["attempts"]
    if n>maximum: raise HTTPException(429,"Zu viele Versuche. Bitte später erneut versuchen.")
def ip(request): return request.client.host if request.client else "unknown"
def create_token(con,user_id,purpose,ttl):
    t,h=new_bearer_secret()
    con.execute("DELETE FROM career_auth.one_time_tokens WHERE user_id=%s AND purpose=%s",(user_id,purpose))
    con.execute("""INSERT INTO career_auth.one_time_tokens(id,user_id,purpose,token_hash,expires_at)
        VALUES(%s,%s,%s,%s,%s)""",(uuid.uuid4(),user_id,purpose,h,now()+ttl))
    return t
def consume(con,t,purpose):
    try: hashed=digest_bearer_secret(t)
    except (ValueError,TypeError,UnicodeError): raise HTTPException(400,"Ungültiger oder abgelaufener Link")
    rec=con.execute("""SELECT id,user_id FROM career_auth.one_time_tokens
        WHERE token_hash=%s AND purpose=%s AND consumed_at IS NULL
        AND expires_at>now() FOR UPDATE""",(hashed,purpose)).fetchone()
    if not rec: raise HTTPException(400,"Ungültiger oder abgelaufener Link")
    con.execute("UPDATE career_auth.one_time_tokens SET consumed_at=now() WHERE id=%s",(rec["id"],))
    return rec["user_id"]
def session(con,request):
    t=request.cookies.get(COOKIE)
    if not t: raise HTTPException(401,"Bitte anmelden")
    try: hashed=digest_bearer_secret(t)
    except (ValueError,UnicodeError): raise HTTPException(401,"Ungültige Sitzung")
    user=con.execute("""SELECT u.*,s.id AS session_id,
        (s.mfa_verified_at IS NOT NULL) AS mfa_verified,
        (f.enabled_at IS NOT NULL) AS totp_enabled
        FROM career_auth.sessions s JOIN career_auth.users u ON u.id=s.user_id
        LEFT JOIN career_auth.totp_credentials f ON f.user_id=u.id
        WHERE s.session_hash=%s AND s.revoked_at IS NULL AND s.expires_at>now()""",(hashed,)).fetchone()
    if not user or user["status"]=="blocked": raise HTTPException(401,"Ungültige Sitzung")
    return user
def gate(user):
    state=permitted_area(AccountState(status=user["status"],email_verified=user["email_verified_at"] is not None,
        role=user["role"],admin_totp_enabled=user["totp_enabled"]))
    if state=="app" and user["totp_enabled"] and not user["mfa_verified"]: state="mfa_required"
    if state!="app": raise HTTPException(403,state)
def admin(user):
    gate(user)
    if user["role"]!="admin": raise HTTPException(403,"Admin-Zugriff erforderlich")
def totpkey(): return Fernet(os.environ["CAREER_AUTH_TOTP_KEY"].encode())
class Registration(BaseModel):
    first_name:str=Field(min_length=1,max_length=120)
    last_name:str=Field(min_length=1,max_length=120)
    residence:str=Field(min_length=1,max_length=250)
    birth_date:str|None=None
    email:EmailStr
    password:str=Field(min_length=12,max_length=1024)
class Credentials(BaseModel):
    email:EmailStr
    password:str
    remember:bool=False
class LinkToken(BaseModel): token:str
class ResetEmail(BaseModel): email:EmailStr
class ResetPassword(BaseModel):
    token:str
    password:str=Field(min_length=12,max_length=1024)
class Code(BaseModel): code:str=Field(min_length=6,max_length=8)
class Recovery(BaseModel): code:str

@app.post("/api/auth/register",status_code=202)
def register(data:Registration,request:Request):
    email=canonical_email(data.email)
    limit("register-ip",ip(request),12,3600)
    with db() as con:
        existing=con.execute("SELECT id FROM career_auth.users WHERE lower(trim(email))=%s",(email,)).fetchone()
        t=None
        if not existing:
            uid=uuid.uuid4()
            con.execute("""INSERT INTO career_auth.users(id,email,first_name,last_name,residence,birth_date,password_hash)
                VALUES(%s,%s,%s,%s,%s,%s,%s)""",(uid,email,data.first_name.strip(),data.last_name.strip(),
                data.residence.strip(),data.birth_date,hash_password(data.password)))
            t=create_token(con,uid,"verify_email",timedelta(hours=24))
        if t: queue_mail(con,email,"Bestätige deine E-Mail-Adresse",f"Bestätige: {origin()}/account/verify?token={quote(t)}")
    return {"message":"Falls eine Registrierung möglich ist, erhältst du eine E-Mail."}

@app.post("/api/auth/verify-email")
def verify(data:LinkToken):
    with db() as con:
        uid=consume(con,data.token,"verify_email")
        con.execute("UPDATE career_auth.users SET email_verified_at=now(),updated_at=now() WHERE id=%s",(uid,))
        admin_addresses=[a["email"] for a in con.execute("SELECT email FROM career_auth.users WHERE role='admin' AND status='active'").fetchall()]
        for address in admin_addresses:
            queue_mail(con,address,"Neue Career.Agency Registrierung","Ein bestätigtes Konto wartet auf Freischaltung im Admin-Dashboard.")
    return {"message":"E-Mail bestätigt. Dein Konto wartet auf Freischaltung."}

@app.post("/api/auth/login")
def login(data:Credentials,request:Request,response:Response):
    email=canonical_email(data.email)
    limit("login-ip",ip(request),40);limit("login-user",email,8)
    with db() as con:
        u=con.execute("""SELECT u.*,(f.enabled_at IS NOT NULL) AS totp_enabled FROM career_auth.users u
            LEFT JOIN career_auth.totp_credentials f ON f.user_id=u.id
            WHERE lower(trim(email))=%s""",(email,)).fetchone()
        if not u or not u["password_hash"] or not password_matches(u["password_hash"],data.password) or u["status"]=="blocked":
            raise HTTPException(401,"E-Mail oder Passwort falsch")
        t,h=new_bearer_secret()
        con.execute("INSERT INTO career_auth.sessions(id,user_id,session_hash,expires_at) VALUES(%s,%s,%s,%s)",
            (uuid.uuid4(),u["id"],h,expiry_for_session(now(),data.remember)))
    response.set_cookie(COOKIE,t,secure=True,httponly=True,samesite="lax",path="/",
                        max_age=int((timedelta(days=45) if data.remember else timedelta(hours=72)).total_seconds()))
    state=permitted_area(AccountState(u["status"],u["email_verified_at"] is not None,u["role"],u["totp_enabled"]))
    return {"next":"mfa_required" if state=="app" and u["totp_enabled"] else state}

@app.get("/api/auth/me")
def me(request:Request):
    with db() as con:
        u=session(con,request)
        state=permitted_area(AccountState(u["status"],u["email_verified_at"] is not None,u["role"],u["totp_enabled"]))
        if state=="app" and u["totp_enabled"] and not u["mfa_verified"]: state="mfa_required"
    return {"id":str(u["id"]),"first_name":u["first_name"],"role":u["role"],"status":u["status"],"next":state}

@app.post("/api/auth/logout")
def logout(request:Request,response:Response):
    with db() as con:
        u=session(con,request)
        con.execute("UPDATE career_auth.sessions SET revoked_at=now() WHERE id=%s",(u["session_id"],))
    response.delete_cookie(COOKIE,path="/",secure=True,httponly=True,samesite="lax")
    return {"message":"Abgemeldet"}

@app.post("/api/auth/password-reset/request")
def reset_request(data:ResetEmail,request:Request):
    email=canonical_email(data.email)
    limit("reset-ip",ip(request),8,3600)
    with db() as con:
        u=con.execute("SELECT id FROM career_auth.users WHERE lower(trim(email))=%s",(email,)).fetchone()
        t=create_token(con,u["id"],"reset_password",timedelta(minutes=30)) if u else None
        if t: queue_mail(con,email,"Passwort zurücksetzen",f"Passwort zurücksetzen: {origin()}/account/reset?token={quote(t)}")
    return {"message":"Falls die Adresse existiert, erhältst du eine E-Mail."}

@app.post("/api/auth/password-reset/confirm")
def reset_confirm(data:ResetPassword):
    p=hash_password(data.password)
    with db() as con:
        uid=consume(con,data.token,"reset_password")
        con.execute("UPDATE career_auth.users SET password_hash=%s,updated_at=now() WHERE id=%s",(p,uid))
        con.execute("UPDATE career_auth.sessions SET revoked_at=now() WHERE user_id=%s AND revoked_at IS NULL",(uid,))
    return {"message":"Passwort geändert. Bitte neu anmelden."}

@app.post("/api/auth/totp/setup")
def mfa_setup(request:Request):
    with db() as con:
        u=session(con,request)
        if u["totp_enabled"]: raise HTTPException(409,"2FA bereits aktiv")
        secret=pyotp.random_base32()
        con.execute("""INSERT INTO career_auth.totp_credentials(user_id,encrypted_secret,key_version)
          VALUES(%s,%s,1) ON CONFLICT(user_id) DO UPDATE SET
          encrypted_secret=excluded.encrypted_secret,enabled_at=NULL,last_used_step=NULL""",
          (u["id"],totpkey().encrypt(secret.encode())))
    return {"secret":secret,"uri":pyotp.TOTP(secret).provisioning_uri(name=u["email"],issuer_name="Career.Agency")}

@app.post("/api/auth/totp/confirm")
def mfa_confirm(data:Code,request:Request):
    with db() as con:
        u=session(con,request)
        f=con.execute("SELECT * FROM career_auth.totp_credentials WHERE user_id=%s FOR UPDATE",(u["id"],)).fetchone()
        if not f or f["enabled_at"]: raise HTTPException(409,"Keine offene Einrichtung")
        secret=totpkey().decrypt(bytes(f["encrypted_secret"])).decode()
        if not pyotp.TOTP(secret).verify(data.code,valid_window=1): raise HTTPException(401,"Ungültiger Code")
        con.execute("UPDATE career_auth.totp_credentials SET enabled_at=now(),last_used_step=%s WHERE user_id=%s",
                    (int(now().timestamp())//30,u["id"]))
        con.execute("UPDATE career_auth.sessions SET mfa_verified_at=now() WHERE id=%s",(u["session_id"],))
        codes=[new_bearer_secret() for _ in range(10)]
        con.cursor().executemany("INSERT INTO career_auth.recovery_codes(id,user_id,code_hash) VALUES(%s,%s,%s)",
                        [(uuid.uuid4(),u["id"],h) for _,h in codes])
    return {"recovery_codes":[t for t,_ in codes]}

@app.post("/api/auth/totp/verify")
def mfa_verify(data:Code,request:Request):
    with db() as con:
        u=session(con,request)
        limit("mfa-user",str(u["id"]),8)
        f=con.execute("""SELECT * FROM career_auth.totp_credentials
          WHERE user_id=%s AND enabled_at IS NOT NULL FOR UPDATE""",(u["id"],)).fetchone()
        if not f: raise HTTPException(400,"2FA nicht aktiv")
        secret=totpkey().decrypt(bytes(f["encrypted_secret"])).decode()
        t=pyotp.TOTP(secret);step=int(now().timestamp())//30
        matched=next((s for s in (step-1,step,step+1)
            if s>(f["last_used_step"] if f["last_used_step"] is not None else -1)
            and t.at(s*30)==data.code),None)
        if matched is None: raise HTTPException(401,"Ungültiger Code")
        con.execute("UPDATE career_auth.totp_credentials SET last_used_step=%s WHERE user_id=%s",(matched,u["id"]))
        con.execute("UPDATE career_auth.sessions SET mfa_verified_at=now() WHERE id=%s",(u["session_id"],))
    return {"next":"app"}

@app.post("/api/auth/totp/recover")
def mfa_recover(data:Recovery,request:Request):
    with db() as con:
        u=session(con,request)
        limit("recovery-user",str(u["id"]),8)
        try: hashed=digest_bearer_secret(data.code)
        except (ValueError,UnicodeError): raise HTTPException(401,"Ungültiger Wiederherstellungscode")
        f=con.execute("""SELECT id FROM career_auth.recovery_codes WHERE
          user_id=%s AND code_hash=%s AND consumed_at IS NULL FOR UPDATE""",(u["id"],hashed)).fetchone()
        if not f: raise HTTPException(401,"Ungültiger Wiederherstellungscode")
        con.execute("UPDATE career_auth.recovery_codes SET consumed_at=now() WHERE id=%s",(f["id"],))
        con.execute("UPDATE career_auth.sessions SET mfa_verified_at=now() WHERE id=%s",(u["session_id"],))
    return {"next":"app"}

@app.get("/api/admin/users")
def users(request:Request):
    with db() as con:
        u=session(con,request);admin(u)
        rows=con.execute("""SELECT id,email,first_name,last_name,status,email_verified_at,created_at
            FROM career_auth.users WHERE role='user' ORDER BY created_at DESC LIMIT 200""").fetchall()
    return {"users":rows}

@app.post("/api/admin/users/{user_id}/activate")
def activate(user_id:uuid.UUID,request:Request):
    with db() as con:
        a=session(con,request);admin(a)
        u=con.execute("SELECT * FROM career_auth.users WHERE id=%s AND role='user' FOR UPDATE",(user_id,)).fetchone()
        if not u: raise HTTPException(404,"Konto nicht gefunden")
        if not u["email_verified_at"]: raise HTTPException(409,"E-Mail noch nicht bestätigt")
        con.execute("UPDATE career_auth.users SET status='active',activated_at=now(),blocked_at=NULL WHERE id=%s",(user_id,))
        con.execute("INSERT INTO career_auth.admin_audit(id,actor_user_id,target_user_id,action) VALUES(%s,%s,%s,%s)",
                    (uuid.uuid4(),a["id"],user_id,"activate_user"))
        queue_mail(con,u["email"],"Dein Career Agency Konto ist freigeschaltet",
         f"Hey {u['first_name']}! 🚀\nYes! Dein Career.Agency-Konto ist jetzt freigeschaltet! 🎉\n"
         f"Deine Zukunft. Dein Weg. Deine Agency.\n{origin()}/account/login")
    return {"message":"Konto freigeschaltet"}

@app.post("/api/admin/users/{user_id}/block")
def block(user_id:uuid.UUID,request:Request):
    with db() as con:
        a=session(con,request);admin(a)
        u=con.execute("SELECT id FROM career_auth.users WHERE id=%s AND role='user' FOR UPDATE",(user_id,)).fetchone()
        if not u: raise HTTPException(404,"Konto nicht gefunden")
        con.execute("UPDATE career_auth.users SET status='blocked',blocked_at=now() WHERE id=%s",(user_id,))
        con.execute("UPDATE career_auth.sessions SET revoked_at=now() WHERE user_id=%s",(user_id,))
        con.execute("INSERT INTO career_auth.admin_audit(id,actor_user_id,target_user_id,action) VALUES(%s,%s,%s,%s)",
                    (uuid.uuid4(),a["id"],user_id,"block_user"))
    return {"message":"Konto gesperrt"}

@app.get("/api/auth/check-app")
def check_app(request:Request):
    # Caddy MUST enforce this gate before serving any private app asset.
    with db() as con:
        u=session(con,request);gate(u)
    return {"ok":True}

@app.post("/api/auth/verify-email/resend")
def resend_verification(data:ResetEmail,request:Request):
    email=canonical_email(data.email)
    limit("verify-resend-ip",ip(request),8,3600)
    with db() as con:
        u=con.execute("""SELECT id FROM career_auth.users WHERE lower(trim(email))=%s
            AND email_verified_at IS NULL AND status='pending'""",(email,)).fetchone()
        t=create_token(con,u["id"],"verify_email",timedelta(hours=24)) if u else None
        if t:
            queue_mail(con,email,"Bestätige deine E-Mail-Adresse",f"Bestätige: {origin()}/account/verify?token={quote(t)}")
    return {"message":"Falls eine Bestätigung aussteht, erhältst du einen neuen Link."}

@app.post("/api/admin/users/{user_id}/unblock")
def unblock(user_id:uuid.UUID,request:Request):
    with db() as con:
        a=session(con,request);admin(a)
        u=con.execute("SELECT id,email_verified_at FROM career_auth.users WHERE id=%s AND role='user' FOR UPDATE",(user_id,)).fetchone()
        if not u: raise HTTPException(404,"Konto nicht gefunden")
        new_status="active" if u["email_verified_at"] else "pending"
        con.execute("UPDATE career_auth.users SET status=%s,blocked_at=NULL WHERE id=%s",(new_status,user_id))
        con.execute("INSERT INTO career_auth.admin_audit(id,actor_user_id,target_user_id,action) VALUES(%s,%s,%s,%s)",
                    (uuid.uuid4(),a["id"],user_id,"unblock_user"))
    return {"message":"Sperrung aufgehoben"}
