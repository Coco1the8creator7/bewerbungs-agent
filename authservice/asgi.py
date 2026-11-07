"""ASGI entrypoint. Private staging only until Caddy routes and data access are reviewed."""
from pathlib import Path
from fastapi.responses import FileResponse
from fastapi import Request, HTTPException
from .app import app, db, session, admin, gate

@app.get("/account/{page}",include_in_schema=False)
def account_page(page: str):
    if page not in {"login","register","waiting","verify","reset","mfa"}:
        from fastapi import HTTPException
        raise HTTPException(404,"Not found")
    return FileResponse(Path(__file__).with_name("account.html"),media_type="text/html",
        headers={"Cache-Control":"no-store"})

@app.get("/admin",include_in_schema=False)
def admin_page(request: Request):
    with db() as con:
        admin(session(con,request))
    return FileResponse(Path(__file__).with_name("account.html"),media_type="text/html",
        headers={"Cache-Control":"no-store"})

# The legacy dashboard uses a shared IndexedDB name and cannot safely serve
# as a per-user private app. Keep it public and unchanged; serve a minimal,
# session-protected account shell until server-side user isolation is built.
@app.get("/app",include_in_schema=False)
@app.get("/app/",include_in_schema=False)
def protected_account_app(request: Request):
    with db() as con:
        gate(session(con,request))
    return FileResponse(Path(__file__).with_name("safe-app.html"),
        media_type="text/html",headers={"Cache-Control":"private, no-store"})

@app.get("/app/{asset_path:path}",include_in_schema=False)
def deny_legacy_private_asset(request: Request,asset_path: str):
    with db() as con:
        gate(session(con,request))
    raise HTTPException(404,"Private legacy assets are unavailable")
