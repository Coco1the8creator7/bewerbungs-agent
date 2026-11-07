"""One-time server-side administrator bootstrap. Run interactively on trusted host only.
Requires production database connection, never run in GitHub Actions or web requests.
"""
import getpass, os, sys, uuid
from auth.security import canonical_email, hash_password
import psycopg
from psycopg.rows import dict_row

def main():
    if not sys.stdin.isatty() or not sys.stdout.isatty():
        raise SystemExit("Interactive TTY required; refuses automated invocation.")
    if os.environ.get("CAREER_AUTH_ALLOW_ADMIN_BOOTSTRAP")!="YES_ONCE":
        raise SystemExit("Set CAREER_AUTH_ALLOW_ADMIN_BOOTSTRAP=YES_ONCE locally after review.")
    address=canonical_email(input("Administrator E-Mail: "))
    first=input("Vorname: ").strip()
    last=input("Nachname: ").strip()
    password=getpass.getpass("Neues Passwort (min. 12 Zeichen): ")
    confirm=getpass.getpass("Passwort wiederholen: ")
    if password!=confirm or not first or not last:
        raise SystemExit("Ungültige Angaben.")
    hashed=hash_password(password)
    with psycopg.connect(os.environ["CAREER_AUTH_DATABASE_URL"],row_factory=dict_row) as con:
        with con.transaction():
            con.execute("LOCK TABLE career_auth.users IN SHARE ROW EXCLUSIVE MODE")
            existing=con.execute("SELECT 1 FROM career_auth.users WHERE role='admin' LIMIT 1").fetchone()
            if existing: raise SystemExit("Administrator existiert bereits. Keine Änderung.")
            con.execute("""INSERT INTO career_auth.users
                (id,email,first_name,last_name,residence,password_hash,role,status,email_verified_at,activated_at)
                VALUES(%s,%s,%s,%s,%s,%s,'admin','active',now(),now())""",
                (uuid.uuid4(),address,first,last,"Admin",hashed))
    print("Administrator eingerichtet. TOTP beim ersten Login verpflichtend. Secret niemals protokollieren.")

if __name__=="__main__": main()
