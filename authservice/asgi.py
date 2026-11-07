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

# A separate authenticated copy of the approved dashboard. The existing
# public landing is not modified. Every asset request gets a fresh DB check;
# never authorize only the HTML shell.
DASHBOARD_ROOT = Path(__file__).resolve().parent.parent / "dashboard"

@app.get("/app",include_in_schema=False)
@app.get("/app/",include_in_schema=False)
@app.get("/app/{asset_path:path}",include_in_schema=False)
def protected_dashboard(request: Request,asset_path: str = ""):
    with db() as con:
        gate(session(con,request))
    # Deny traversal, dotfiles, and anything outside the packaged dashboard.
    if asset_path.startswith("/") or "\\\\" in asset_path:
        raise HTTPException(404,"Not found")
    parts=[p for p in asset_path.split("/") if p]
    if any(p in (".","..") or p.startswith(".") for p in parts):
        raise HTTPException(404,"Not found")
    root=DASHBOARD_ROOT.resolve(strict=True)
    requested=(root.joinpath(*parts) if parts else root / "index.html").resolve()
    if not requested.is_relative_to(root) or not requested.is_file():
        raise HTTPException(404,"Not found")
    return FileResponse(requested,headers={
        "Cache-Control":"private, no-store",
        "X-Content-Type-Options":"nosniff",
        "Content-Security-Policy":"frame-ancestors 'none'"
    })
