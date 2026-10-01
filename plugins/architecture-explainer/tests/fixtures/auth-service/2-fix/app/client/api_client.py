from app.client.token_manager import TokenManager


class ApiClient:
    def __init__(self, transport, tokens: TokenManager):
        self._transport = transport
        self._tokens = tokens

    async def get(self, path: str) -> dict:
        token = await self._tokens.get_access_token()
        response = await self._transport.get(path, headers={"Authorization": f"Bearer {token}"})
        if response["status"] == 401:
            token = await self._tokens.force_refresh(token)
            response = await self._transport.get(path, headers={"Authorization": f"Bearer {token}"})
        return response
