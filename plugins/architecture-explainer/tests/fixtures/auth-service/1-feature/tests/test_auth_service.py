import sqlite3
import unittest

from app.auth.passwords import PasswordHasher
from app.auth.service import AuthService, InvalidCredentials
from app.auth.session_store import RefreshTokenReused, SessionStore
from app.auth.tokens import TokenIssuer
from app.users.repository import UserRepository


class AuthServiceTests(unittest.TestCase):
    def setUp(self):
        self.users = UserRepository(sqlite3.connect(":memory:"))
        self.hasher = PasswordHasher()
        self.users.add("alice", self.hasher.hash("pw"))
        self.issuer = TokenIssuer(b"secret")
        self.sessions = SessionStore()
        self.auth = AuthService(self.users, self.hasher, self.issuer, self.sessions)

    def test_login_issues_access_token_bound_to_session(self):
        pair = self.auth.login("alice", "pw")
        claims = self.issuer.verify_access_token(pair.access_token)
        self.assertTrue(self.sessions.is_active(claims["sid"]))

    def test_wrong_password_is_rejected(self):
        with self.assertRaises(InvalidCredentials):
            self.auth.login("alice", "nope")

    def test_refresh_rotates_refresh_token(self):
        first = self.auth.login("alice", "pw")
        second = self.auth.refresh(first.refresh_token)
        self.assertNotEqual(first.refresh_token, second.refresh_token)

    def test_reusing_a_rotated_refresh_token_revokes_the_session(self):
        first = self.auth.login("alice", "pw")
        second = self.auth.refresh(first.refresh_token)
        with self.assertRaises(RefreshTokenReused):
            self.auth.refresh(first.refresh_token)
        sid = self.issuer.verify_access_token(second.access_token)["sid"]
        self.assertFalse(self.sessions.is_active(sid))


if __name__ == "__main__":
    unittest.main()
