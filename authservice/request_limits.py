"""Bound JSON request bodies before FastAPI parses them, including streamed bodies."""
from starlette.responses import JSONResponse


class RequestLimits:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] not in {"PUT", "PATCH", "POST"}:
            return await self.app(scope, receive, send)
        limit = 5_000_000 if scope["path"].startswith("/api/user/") else 32_768
        body = bytearray()
        while True:
            message = await receive()
            if message["type"] == "http.disconnect":
                return
            chunk = message["body"]
            if len(body) + len(chunk) > limit:
                return await JSONResponse({"detail": "Datenmenge zu gross"}, status_code=413)(scope, receive, send)
            body.extend(chunk)
            if not message.get("more_body"):
                break

        delivered = False

        async def replay():
            nonlocal delivered
            if delivered:
                return await receive()
            delivered = True
            return {"type": "http.request", "body": bytes(body), "more_body": False}

        await self.app(scope, replay, send)
