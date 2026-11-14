"""ASGI entrypoint. Private staging only until Caddy routes and data access are reviewed."""
from pathlib import Path
import base64
import hashlib
import re
from fastapi.responses import FileResponse
from fastapi import Request
from .app import app, db, session, admin, gate
from .private_state import router
app.include_router(router)

def protected_html(html):
    # Only scripts authored in these server templates may execute inline.
    scripts = re.findall(r"<script>(.*?)</script>", html, re.DOTALL)
    hashes = ["'sha256-" + base64.b64encode(hashlib.sha256(s.encode()).digest()).decode() + "'" for s in scripts]
    policy = "script-src 'self' " + " ".join(hashes) + "; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'; connect-src 'self'"
    return HTMLResponse(html, headers={"Cache-Control":"no-store","Content-Security-Policy":policy})

@app.get("/account/{page}",include_in_schema=False)
def account_page(page: str):
    if page not in {"login","register","waiting","verify","reset","mfa","recovery"}:
        from fastapi import HTTPException
        raise HTTPException(404,"Not found")
    return protected_html(Path(__file__).with_name("account.html").read_text())

@app.get("/admin",include_in_schema=False)
def admin_page(request: Request):
    with db() as con:
        admin(session(con,request))
    return protected_html(Path(__file__).with_name("account.html").read_text())

# All private app resources pass the same backend session/approval/MFA gate.
# No public file_server fallback is permitted for /app on the proxy.
import os, json
from fastapi import HTTPException
from fastapi.responses import HTMLResponse, RedirectResponse

@app.get("/healthz")
def health():
    with db() as con:
        for table in ("career_auth.users","career_private.user_state","career_auth.mail_outbox"):
            if not con.execute("SELECT to_regclass(%s) AS name",(table,)).fetchone()["name"]:
                raise HTTPException(503,"Migration missing")
    return {"ok":True}

@app.get("/app")
@app.get("/app/")
@app.get("/app/{asset:path}")
def private_app(request:Request,asset:str=""):
    with db() as con:
        u=session(con,request);gate(u)
    if request.url.path == "/app":
        return RedirectResponse("/app/",status_code=307)
    root=Path(os.environ["CAREER_APP_ROOT"]).resolve()
    name=asset or "index.html"
    # Dossier Studio is explicitly deferred. Do not expose its shared local database
    # through an authenticated account or load its storage adapters into this page.
    if name.startswith(("dossier","account")) and not name.endswith(".css"):
        raise HTTPException(404,"Dossier storage is deferred")
    if name=="lehrstellen.json":
        return FileResponse(os.environ["CAREER_PUBLIC_FEED"],media_type="application/json",headers={"Cache-Control":"no-store"})
    if name=="index.html":
        target=Path(__file__).with_name("mission-control.html")
    else:
        target=(root/name).resolve()
    if (name!="index.html" and target.parent!=root) or target.suffix not in {".html",".js",".css",".svg"} or not target.is_file():
        raise HTTPException(404)
    if name=="index.html":
        html=target.read_text()
        html=html.replace('onclick="appendJobBatch();observeMobileJobs()"', 'id="loadMorePrivateJobs"')
        html=html.replace('<script src="./storage.js"></script>', "")
        html=re.sub(r'<script src="\./dossier[^"<>]*"></script>', '', html)
        marker='<script src="./github-sync.js"></script>'
        if html.count(marker)!=1: raise HTTPException(503,"Unreviewed app HTML")
        context=json.dumps({"id":str(u["id"])})
        html=html.replace(marker,marker+'<script>window.CareerAccount='+context+';</script><script src="./private-state.js"></script>')
        # Necessary storage wording only; no layout or approved design changes.
        html=html.replace('Bewertungen in GitHub speichern','Bewertungen speichern').replace('Inseratebewertungen in GitHub speichern','Inseratebewertungen speichern')
        html=html.replace('GitHub-Bewertungen','Kontobewertungen').replace('GitHub-Zugriff','Kontozugriff')
        html=html.replace('window.GithubFeedback.getToken()', 'window.GithubFeedback.isConnected()')
        html=html.replace('Bitte zuerst den GitHub-Token unten unter Daten & Entwicklung hinterlegen.','Bitte erneut anmelden.')
        html=html.replace('Auf diesem Gerät gespeichert · ','Im Konto gespeichert · ')
        html=html.replace('in GitHub gespeichert','im Konto gespeichert').replace('GitHub-Speicherung','Kontospeicherung')
        html=html.replace('Gespeicherter Arbeitsstand dieses Browsers wiederhergestellt','Gespeicherter Arbeitsstand deines Kontos wiederhergestellt')
        html=html.replace('Eine Benutzeranmeldung und die geschützte Speicherung persönlicher Daten sind noch nicht eingerichtet.','Du bist angemeldet. Bewertungen und Radar-Daten werden getrennt in deinem Konto gespeichert. Dossier Studio folgt separat.')
        return protected_html(html)
    return FileResponse(target,headers={"Cache-Control":"no-store"})
