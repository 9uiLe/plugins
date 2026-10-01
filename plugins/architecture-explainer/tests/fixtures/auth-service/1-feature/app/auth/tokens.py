import base64
import hashlib
import hmac
import json
import secrets
import time

ACCESS_TOKEN_TTL_SECONDS = 15 * 60
REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60


class InvalidToken(Exception):
    pass


class TokenIssuer:
    def __init__(self, secret: bytes, clock=time.time):
        self._secret = secret
        self._clock = clock

    def issue_access_token(self, user_id: int, session_id: str) -> str:
        payload = {"sub": user_id, "sid": session_id, "exp": int(self._clock()) + ACCESS_TOKEN_TTL_SECONDS}
        body = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode()
        return f"{body}.{self._sign(body)}"

    def verify_access_token(self, token: str) -> dict:
        try:
            body, signature = token.split(".")
        except ValueError:
            raise InvalidToken("malformed")
        if not hmac.compare_digest(signature, self._sign(body)):
            raise InvalidToken("bad signature")
        payload = json.loads(base64.urlsafe_b64decode(body))
        if payload["exp"] < self._clock():
            raise InvalidToken("expired")
        return payload

    def new_refresh_token(self) -> str:
        return secrets.token_urlsafe(32)

    def _sign(self, body: str) -> str:
        return hmac.new(self._secret, body.encode(), hashlib.sha256).hexdigest()
