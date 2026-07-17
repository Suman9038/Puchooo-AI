import pytest
from httpx import AsyncClient
from unittest.mock import patch
from app.models.models import User, UserRole
from app.main import app
from app.auth.dependencies import get_current_user

# Fake User
test_user = User(
    id="123e4567-e89b-12d3-a456-426614174000",
    username="videouser",
    email="video@example.com",
    first_name="Video",
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
async def test_add_video_process(async_client: AsyncClient, override_auth):
    # Mock the Celery task so it doesn't actually process the video during testing
    with patch("app.worker.celery.index_video_task.delay") as mock_task:
        with patch("app.auth.dependencies.AccessTokenBearer.__call__") as mock_bearer:
            mock_bearer.return_value = {"user": {"email": test_user.email}, "jti": "fake"}
            
            mock_task.return_value = True
            
            request_payload = {
                "video_url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
            }
            
            headers = {"Authorization": "Bearer faketoken"}
            response = await async_client.post("/videos", json=request_payload, headers=headers)
            
            assert response.status_code in [201, 202]
            data = response.json()
            assert "video_id" in data


@pytest.mark.asyncio
async def test_get_video_status_unauthorized(async_client: AsyncClient):
    # Trying to access without headers should fail
    response = await async_client.get("/videos/some-fake-id/status")
    assert response.status_code == 401
