import asyncio
import unittest

from app.client.token_manager import TokenManager


class FakeTransport:
    def __init__(self):
        self.refresh_calls = 0

    async def post(self, path, body):
        self.refresh_calls += 1
        await asyncio.sleep(0)
        n = self.refresh_calls
        return {"status": 200, "body": {"access_token": f"a{n}", "refresh_token": f"r{n}"}}


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


if __name__ == "__main__":
    unittest.main()
