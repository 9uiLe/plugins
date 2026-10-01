import asyncio
import sqlite3
import unittest

from app.api.routes import build_routes
from app.auth.passwords import PasswordHasher
from app.auth.service import AuthService
from app.auth.session_store import SessionStore
from app.auth.tokens import TokenIssuer
from app.client.token_manager import TokenManager
from app.users.repository import UserRepository


class FakeTransport:
    def __init__(self):
        self.refresh_calls = 0

    async def post(self, path, body):
        self.refresh_calls += 1
        await asyncio.sleep(0)
        n = self.refresh_calls
        return {"status": 200, "body": {"access_token": f"a{n}", "refresh_token": f"r{n}"}}


class InProcessTransport:
    def __init__(self, routes):
        self._routes = routes

    async def post(self, path, body):
        await asyncio.sleep(0)
        return self._routes[("POST", path)]({"body": body})


class TokenManagerTests(unittest.IsolatedAsyncioTestCase):
    async def test_valid_token_is_returned_without_refresh(self):
        transport = FakeTransport()
        manager = TokenManager(transport, "a0", "r0", expires_at=10_000, clock=lambda: 0)
        self.assertEqual(await manager.get_access_token(), "a0")
        self.assertEqual(transport.refresh_calls, 0)

    async def test_expired_token_is_refreshed(self):
        transport = FakeTransport()
        manager = TokenManager(transport, "a0", "r0", expires_at=0, clock=lambda: 100)
        self.assertEqual(await manager.get_access_token(), "a1")

    async def test_concurrent_callers_share_one_refresh(self):
        transport = FakeTransport()
        manager = TokenManager(transport, "a0", "r0", expires_at=0, clock=lambda: 100)
        tokens = await asyncio.gather(*(manager.get_access_token() for _ in range(5)))
        self.assertEqual(transport.refresh_calls, 1)
        self.assertEqual(set(tokens), {"a1"})

    async def test_force_refresh_skips_when_token_already_replaced(self):
        transport = FakeTransport()
        manager = TokenManager(transport, "a0", "r0", expires_at=10_000, clock=lambda: 0)
        await asyncio.gather(manager.force_refresh("a0"), manager.force_refresh("a0"))
        self.assertEqual(await manager.force_refresh("a0"), "a1")
        self.assertEqual(transport.refresh_calls, 1)

    async def test_concurrent_refresh_does_not_trigger_server_reuse_detection(self):
        users = UserRepository(sqlite3.connect(":memory:"))
        hasher = PasswordHasher()
        users.add("alice", hasher.hash("pw"))
        issuer, sessions = TokenIssuer(b"secret"), SessionStore()
        auth = AuthService(users, hasher, issuer, sessions)
        pair = auth.login("alice", "pw")
        manager = TokenManager(InProcessTransport(build_routes(auth, issuer, sessions, users)),
                               pair.access_token, pair.refresh_token, expires_at=0)
        tokens = await asyncio.gather(*(manager.get_access_token() for _ in range(3)))
        self.assertTrue(sessions.is_active(issuer.verify_access_token(tokens[0])["sid"]))


if __name__ == "__main__":
    unittest.main()
