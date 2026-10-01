from app.auth.session_store import SessionStore
from app.auth.tokens import InvalidToken, TokenIssuer


def require_auth(issuer: TokenIssuer, sessions: SessionStore):
    def decorator(handler):
        def wrapper(request: dict) -> dict:
            header = request.get("headers", {}).get("Authorization", "")
            if not header.startswith("Bearer "):
                return {"status": 401, "body": {"error": "missing_token"}}
            try:
                claims = issuer.verify_access_token(header.removeprefix("Bearer "))
            except InvalidToken as exc:
                return {"status": 401, "body": {"error": str(exc)}}
            if not sessions.is_active(claims["sid"]):
                return {"status": 401, "body": {"error": "session_revoked"}}
            return handler({**request, "user_id": claims["sub"], "session_id": claims["sid"]})
        return wrapper
    return decorator
