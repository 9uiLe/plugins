from dataclasses import dataclass

from app.auth.passwords import PasswordHasher
from app.auth.session_store import SessionStore
from app.auth.tokens import TokenIssuer
from app.users.repository import UserRepository


class InvalidCredentials(Exception):
    pass


@dataclass(frozen=True)
class TokenPair:
    access_token: str
    refresh_token: str


class AuthService:
    def __init__(self, users: UserRepository, hasher: PasswordHasher, issuer: TokenIssuer, sessions: SessionStore):
        self._users = users
        self._hasher = hasher
        self._issuer = issuer
        self._sessions = sessions

    def login(self, username: str, password: str) -> TokenPair:
        user = self._users.find_by_username(username)
        if user is None or not self._hasher.verify(password, user.password_hash):
            raise InvalidCredentials()
        refresh_token = self._issuer.new_refresh_token()
        session = self._sessions.create(user.id, refresh_token)
        return TokenPair(self._issuer.issue_access_token(user.id, session.id), refresh_token)

    def refresh(self, refresh_token: str) -> TokenPair:
        new_refresh_token = self._issuer.new_refresh_token()
        session = self._sessions.rotate(refresh_token, new_refresh_token)
        return TokenPair(self._issuer.issue_access_token(session.user_id, session.id), new_refresh_token)

    def logout(self, session_id: str) -> None:
        self._sessions.revoke(session_id)
