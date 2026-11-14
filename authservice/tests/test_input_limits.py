import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from authservice.asgi import app


class InputTests(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.env = patch.dict("os.environ", CAREER_AUTH_PUBLIC_ORIGIN="http://testserver")
        self.env.start()
        self.addCleanup(self.env.stop)
        self.client.headers["Origin"] = "http://testserver"

    def test_account_errors_do_not_echo_credentials(self):
        body = {"email":"ada@example.com","password":"private-test-password","role":"admin"}
        response = self.client.post("/api/auth/login", json=body)
        self.assertEqual(response.status_code, 422)
        self.assertNotIn(body["password"], response.text)

    def test_two_accounts_bind_private_api_to_the_open_tab(self):
        from authservice.private_state import owner
        from fastapi import HTTPException
        from unittest.mock import Mock
        from uuid import UUID
        accounts = [UUID(int=1), UUID(int=2)]
        for current in accounts:
            with patch("authservice.private_state.session", return_value={"id":current}), patch("authservice.private_state.gate"):
                for tab in accounts:
                    connection = Mock()
                    request = Mock(headers={"X-Career-Account":str(tab)})
                    if tab == current:
                        self.assertEqual(owner(connection, request), current)
                        connection.execute.assert_called_once()
                    else:
                        with self.assertRaises(HTTPException) as error:
                            owner(connection, request)
                        self.assertEqual(error.exception.status_code,409)
                        connection.execute.assert_not_called()

    def test_streamed_login_is_bounded(self):
        response = self.client.post("/api/auth/login", content=iter([b"x"*20000]*2))
        self.assertEqual(response.status_code, 413)

    def test_registration_rejects_empty_and_control_fields(self):
        body = dict(first_name="Ada",last_name="Muster",email="ada@example.com",
                    password="private-test-password",residence="Bern")
        for invalid in ["   ", "Bern\nZH"]:
            response = self.client.post("/api/auth/register",json={**body,"residence":invalid})
            self.assertEqual(response.status_code,422)

    def test_account_pages_have_script_policy(self):
        response = self.client.get("/account/register")
        self.assertIn("'sha256-",response.headers["Content-Security-Policy"])
        self.assertNotIn("'unsafe-inline'",response.headers["Content-Security-Policy"])

    def test_public_entry_has_both_links_and_no_private_scripts(self):
        public = (Path(__file__).resolve().parents[2]/"dashboard/index.html").read_text()
        for path in ["/account/login","/account/register"]:
            self.assertIn(f'href="{path}"',public)
        self.assertNotIn("<script",public)
