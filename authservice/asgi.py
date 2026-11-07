"""ASGI entrypoint. Private staging only until Caddy routes and data access are reviewed."""
from pathlib import Path
from fastapi.responses import FileResponse
from fastapi import Request
from .app import app, db, session, admin

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
