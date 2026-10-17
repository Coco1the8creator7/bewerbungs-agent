"""Optional local-only Gmail OAuth reader: read-only scope."""
from datetime import datetime, timezone
from email import policy
from email.parser import BytesParser
from base64 import urlsafe_b64decode
from pathlib import Path
from .main import parse_eml

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

def iter_gmail(credentials_path="local/credentials.json", token_path="local/token.json", query="newer_than:90d"):
    try:
        from google.auth.transport.requests import Request
        from google.oauth2.credentials import Credentials
        from google_auth_oauthlib.flow import InstalledAppFlow
        from googleapiclient.discovery import build
    except ImportError as exc:
        raise RuntimeError("Install requirements-gmail.txt for local Gmail use") from exc
    credentials, token = Path(credentials_path), Path(token_path)
    token.parent.mkdir(parents=True, exist_ok=True)
    creds = Credentials.from_authorized_user_file(str(token), SCOPES) if token.exists() else None
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            creds = InstalledAppFlow.from_client_secrets_file(str(credentials), SCOPES).run_local_server(port=0)
        token.write_text(creds.to_json(), encoding="utf-8")
        token.chmod(0o600)
    service = build("gmail", "v1", credentials=creds, cache_discovery=False)
    page = None
    while True:
        result = service.users().messages().list(userId="me", q=query, maxResults=100, pageToken=page).execute()
        for item in result.get("messages", []):
            raw = service.users().messages().get(userId="me", id=item["id"], format="raw").execute()
            blob = raw["raw"]
            payload = urlsafe_b64decode(blob + "=" * (-len(blob) % 4))
            mail = BytesParser(policy=policy.default).parsebytes(payload)
            texts, htmls = [], []
            for part in (mail.walk() if mail.is_multipart() else [mail]):
                if part.get_content_disposition() == "attachment":
                    continue
                if part.get_content_type() == "text/plain":
                    texts.append(str(part.get_content()))
                elif part.get_content_type() == "text/html":
                    htmls.append(str(part.get_content()))
            received = datetime.fromtimestamp(int(raw["internalDate"])/1000, timezone.utc).isoformat()
            yield {"id": item["id"], "from": str(mail.get("From", "")), "subject": str(mail.get("Subject", "")),
                   "body": "\n".join(texts), "html": "\n".join(htmls), "received_at": received}
        page = result.get("nextPageToken")
        if not page:
            break
