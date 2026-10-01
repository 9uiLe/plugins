from app.auth.middleware import require_auth
from app.auth.service import AuthService, InvalidCredentials
from app.auth.session_store import RefreshTokenReused, SessionStore, UnknownRefreshToken
from app.auth.tokens import TokenIssuer
from app.users.repository import UserRepository


def build_routes(auth: AuthService, issuer: TokenIssuer, sessions: SessionStore, users: UserRepository):
    def login(request: dict) -> dict:
        try:
            pair = auth.login(request["body"]["username"], request["body"]["password"])
        except InvalidCredentials:
            return {"status": 401, "body": {"error": "invalid_credentials"}}
        return {"status": 200, "body": {"access_token": pair.access_token, "refresh_token": pair.refresh_token}}

    def refresh(request: dict) -> dict:
        try:
            pair = auth.refresh(request["body"]["refresh_token"])
        except RefreshTokenReused:
            return {"status": 401, "body": {"error": "refresh_token_reused"}}
        except UnknownRefreshToken:
            return {"status": 401, "body": {"error": "invalid_refresh_token"}}
        return {"status": 200, "body": {"access_token": pair.access_token, "refresh_token": pair.refresh_token}}

    @require_auth(issuer, sessions)
    def me(request: dict) -> dict:
        user = users.find_by_id(request["user_id"])
        return {"status": 200, "body": {"id": user.id, "username": user.username}}

    @require_auth(issuer, sessions)
    def logout(request: dict) -> dict:
        auth.logout(request["session_id"])
        return {"status": 204, "body": None}

    return {
        ("POST", "/login"): login,
        ("POST", "/token/refresh"): refresh,
        ("GET", "/me"): me,
        ("POST", "/logout"): logout,
    }
