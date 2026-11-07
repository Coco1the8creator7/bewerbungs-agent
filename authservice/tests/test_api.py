"""Disposable PostgreSQL integration tests. Never point at production."""
import os,re,uuid,unittest
import psycopg,pyotp
from cryptography.fernet import Fernet
from fastapi.testclient import TestClient
from authservice import asgi as server
from authservice import app as api_module
from auth.security import hash_password

@unittest.skipUnless(os.getenv("CAREER_AUTH_TEST_DATABASE_URL"),"requires isolated PostgreSQL")
class AuthIntegration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        os.environ["CAREER_AUTH_DATABASE_URL"]=os.environ["CAREER_AUTH_TEST_DATABASE_URL"]
        os.environ["CAREER_AUTH_PUBLIC_ORIGIN"]="https://testserver"
        os.environ["CAREER_AUTH_MAIL_FROM"]="noreply@careeragency.ch"
        os.environ["CAREER_AUTH_TOTP_KEY"]=Fernet.generate_key().decode()
        os.environ["CAREER_APP_ROOT"]=str(__import__("pathlib").Path(__file__).resolve().parents[2]/"dashboard")
        cls.messages=[]
        api_module.queue_mail=lambda con,to,subject,body:cls.messages.append((to,subject,body))
        cls.client=TestClient(server.app,base_url="https://testserver")
    def setUp(self):
        self.client.cookies.clear()
        self.messages.clear()
        with psycopg.connect(os.environ["CAREER_AUTH_DATABASE_URL"]) as con:
            con.execute("""TRUNCATE career_auth.admin_audit,career_auth.recovery_codes,
                career_auth.totp_credentials,career_auth.sessions,career_auth.one_time_tokens,
                career_auth.rate_counters,career_auth.users CASCADE""")
    def post(self,path,data=None):
        return self.client.post(path,json=data or {},headers={"Origin":"https://testserver"})
    def test_registration_admin_approval_and_block(self):
        data={"first_name":"Ada","last_name":"Test","residence":"Zürich",
              "email":"ada@example.com","password":"a reasonably long password"}
        r=self.post("/api/auth/register",data)
        self.assertEqual(r.status_code,202,r.text)
        self.assertEqual(len(self.messages),1)
        token=re.search(r"token=([\w-]+)",self.messages[0][2]).group(1)
        self.assertEqual(self.post("/api/auth/verify-email",{"token":token}).status_code,200)
        self.assertEqual(self.post("/api/auth/verify-email",{"token":token}).status_code,400)
        self.assertEqual(self.post("/api/auth/register",data).status_code,202)
        self.assertEqual(len(self.messages),1)
        r=self.post("/api/auth/login",{"email":data["email"],"password":data["password"]})
        self.assertEqual(r.json()["next"],"waiting",r.text)
        self.assertEqual(self.client.get("/api/auth/check-app").status_code,403)
        self.assertEqual(self.client.get("/app/").status_code,403)
        user_session=self.client.cookies.get("ca_session")
        admin_id=uuid.uuid4()
        with psycopg.connect(os.environ["CAREER_AUTH_DATABASE_URL"]) as con:
            con.execute("""INSERT INTO career_auth.users
                (id,email,first_name,last_name,residence,password_hash,role,status,email_verified_at)
                VALUES(%s,%s,%s,%s,%s,%s,%s,%s,now())""",
                (admin_id,"admin@example.com","Admin","Test","Zürich",
                 hash_password("another long password"),"admin","active"))
            user_id=con.execute("SELECT id FROM career_auth.users WHERE email=%s",(data["email"],)).fetchone()[0]
        self.client.cookies.clear()
        r=self.post("/api/auth/login",{"email":"admin@example.com","password":"another long password"})
        self.assertEqual(r.json()["next"],"admin_2fa_setup",r.text)
        self.assertEqual(self.client.get("/api/admin/users").status_code,403)
        self.assertEqual(self.client.get("/admin").status_code,403)
        setup=self.post("/api/auth/totp/setup").json()
        self.assertIn("secret",setup)
        code=pyotp.TOTP(setup["secret"]).now()
        r=self.post("/api/auth/totp/confirm",{"code":code})
        self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(len(r.json()["recovery_codes"]),10)
        self.assertEqual(self.client.get("/api/admin/users").status_code,200)
        self.assertEqual(self.client.get("/admin").status_code,200)
        self.assertEqual(self.client.get("/app/").status_code,200)
        self.assertIn("CareerAccount",self.client.get("/app/").text)
        self.assertNotIn('<script src="./dossiers.js',self.client.get("/app/").text)
        self.assertEqual(self.client.get("/app/dossier-studio.html").status_code,404)
        self.assertEqual(self.client.get("/app/../authservice/app.py").status_code,404)
        r=self.post("/api/admin/users/"+str(user_id)+"/activate")
        self.assertEqual(r.status_code,200,r.text)
        self.assertIn("freigeschaltet",self.messages[-1][1])
        r=self.post("/api/admin/users/"+str(user_id)+"/block")
        self.assertEqual(r.status_code,200,r.text)
        self.client.cookies.clear()
        self.client.cookies.set("ca_session",user_session,path="/")
        self.assertEqual(self.client.get("/api/auth/check-app").status_code,401)
        self.assertEqual(self.client.get("/app/").status_code,401)

    def test_throttle_rollback_protected(self):
        data={"email":"absent@example.com","password":"wrongwrongwrong"}
        for _ in range(8):
            self.assertEqual(self.post("/api/auth/login",data).status_code,401)
        self.assertEqual(self.post("/api/auth/login",data).status_code,429)

    def test_unsafe_origin_rejected(self):
        self.assertEqual(self.client.post("/api/auth/register",json={}).status_code,403)
        self.assertEqual(self.client.get("/api/auth/check-app").status_code,401)
