import asyncio
import time


class SessionExpired(Exception):
    pass


class TokenManager:
    """Holds the client's tokens and refreshes the access token when it expires."""

    def __init__(self, transport, access_token: str, refresh_token: str, expires_at: float, clock=time.time):
        self._transport = transport
        self._access_token = access_token
        self._refresh_token = refresh_token
        self._expires_at = expires_at
        self._clock = clock
        self._refresh_task: asyncio.Task | None = None

    async def get_access_token(self) -> str:
        if self._clock() >= self._expires_at - 30:
            await self._refresh_once()
        return self._access_token

    async def force_refresh(self, rejected_token: str) -> str:
        if self._access_token == rejected_token:
            await self._refresh_once()
        return self._access_token

    async def _refresh_once(self) -> None:
        # The server revokes the whole session when a rotated refresh token is
        # presented again, so concurrent callers must share one refresh request.
        task = self._refresh_task
        if task is None:
            task = self._refresh_task = asyncio.create_task(self._refresh())
        try:
            await asyncio.shield(task)
        finally:
            if self._refresh_task is task and task.done():
                self._refresh_task = None

    async def _refresh(self) -> None:
        response = await self._transport.post("/token/refresh", {"refresh_token": self._refresh_token})
        if response["status"] != 200:
            raise SessionExpired(response["body"]["error"])
        self._access_token = response["body"]["access_token"]
        self._refresh_token = response["body"]["refresh_token"]
        self._expires_at = self._clock() + 15 * 60
