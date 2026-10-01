import secrets
import threading
import time
from dataclasses import dataclass, field

from app.auth.tokens import REFRESH_TOKEN_TTL_SECONDS


class RefreshTokenReused(Exception):
    pass


class UnknownRefreshToken(Exception):
    pass


@dataclass
class Session:
    id: str
    user_id: int
    refresh_token: str
    expires_at: float
    revoked: bool = False
    retired_tokens: set[str] = field(default_factory=set)


class SessionStore:
    def __init__(self, clock=time.time):
        self._sessions: dict[str, Session] = {}
        self._by_token: dict[str, str] = {}
        self._lock = threading.Lock()
        self._clock = clock

    def create(self, user_id: int, refresh_token: str) -> Session:
        with self._lock:
            session = Session(secrets.token_hex(8), user_id, refresh_token,
                              self._clock() + REFRESH_TOKEN_TTL_SECONDS)
            self._sessions[session.id] = session
            self._by_token[refresh_token] = session.id
            return session

    def rotate(self, presented_token: str, new_token: str) -> Session:
        with self._lock:
            session_id = self._by_token.get(presented_token)
            if session_id is None:
                raise UnknownRefreshToken()
            session = self._sessions[session_id]
            if session.revoked or session.expires_at < self._clock():
                raise UnknownRefreshToken()
            if presented_token in session.retired_tokens:
                session.revoked = True
                raise RefreshTokenReused()
            session.retired_tokens.add(presented_token)
            session.refresh_token = new_token
            self._by_token[new_token] = session.id
            return session

    def revoke(self, session_id: str) -> None:
        with self._lock:
            if session_id in self._sessions:
                self._sessions[session_id].revoked = True

    def is_active(self, session_id: str) -> bool:
        session = self._sessions.get(session_id)
        return bool(session and not session.revoked and session.expires_at >= self._clock())
