import pytest
from httpx import AsyncClient
from unittest.mock import patch
from app.models.models import User, UserRole
from app.main import app
from app.auth.dependencies import get_current_user

# Fake User
test_user = User(
    id="123e4567-e89b-12d3-a456-426614174000",
    username="raguser",
    email="rag@example.com",
    first_name="Rag",
    last_name="User",
    role=UserRole.USER,
    is_verified=True
)

async def override_get_current_user():
    return test_user

@pytest.fixture
def override_auth():
    app.dependency_overrides[get_current_user] = override_get_current_user
    yield
    app.dependency_overrides.clear()

@pytest.mark.asyncio
async def test_create_conversation_invalid_video(async_client: AsyncClient, override_auth):
    with patch("app.auth.dependencies.AccessTokenBearer.__call__") as mock_bearer:
        mock_bearer.return_value = {"user": {"email": test_user.email}, "jti": "fake"}
        
        # Trying to create a conversation for a video that doesn't exist should fail
        payload = {
            "youtube_url": "https://www.youtube.com/watch?v=invalid"
        }
        headers = {"Authorization": "Bearer faketoken"}
        response = await async_client.post("/chat/conversations", json=payload, headers=headers)
        
        # The route returns 400 if video URL is invalid
        assert response.status_code == 400

@pytest.mark.asyncio
async def test_ask_question_unauthorized(async_client: AsyncClient):
    payload = {
        "question": "What is Python?"
    }
    response = await async_client.post("/chat/conversations/some-fake-uuid/ask", json=payload)
    assert response.status_code == 401
