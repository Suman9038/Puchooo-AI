import pytest
from httpx import AsyncClient
from unittest.mock import patch
from app.models.models import User, UserRole

# Sample user data for tests
test_user = {
    "username": "testuser",
    "email": "testuser@example.com",
    "password": "StrongPassword@123",
    "first_name": "Test",
    "last_name": "User"
}

@pytest.mark.asyncio
async def test_register_user(async_client: AsyncClient):
    with patch("app.worker.celery.send_verification_email_task.delay") as mock_task:
        mock_task.return_value = True
        response = await async_client.post("/auth/signup", json=test_user)
        
        assert response.status_code == 201
        data = response.json()
        assert "user" in data
        assert data["user"]["email"] == test_user["email"]


@pytest.mark.asyncio
async def test_register_duplicate_user(async_client: AsyncClient):
    with patch("app.worker.celery.send_verification_email_task.delay"):
        # First, make sure the user is registered
        await async_client.post("/auth/signup", json=test_user)
        
        # Try registering again
        response = await async_client.post("/auth/signup", json=test_user)
        assert response.status_code == 403 # UserAlreadyExists throws 403


@pytest.mark.asyncio
async def test_login_user_unverified(async_client: AsyncClient):
    with patch("app.worker.celery.send_verification_email_task.delay"):
        # Ensure user exists
        await async_client.post("/auth/signup", json=test_user)
        
        login_data = {
            "email": test_user["email"],
            "password": test_user["password"]
        }
        response = await async_client.post("/auth/login", json=login_data)
        
        # Expecting 403 because account is not verified yet!
        assert response.status_code == 403


@pytest.mark.asyncio
async def test_login_user_invalid_credentials(async_client: AsyncClient):
    login_data = {
        "email": "wronguser@example.com",
        "password": "wrongpassword"
    }
    response = await async_client.post("/auth/login", json=login_data)
    
    assert response.status_code == 403 # UserNotExists


@pytest.mark.asyncio
async def test_get_current_user(async_client: AsyncClient):
    # For protected routes, we can use dependency_overrides in FastAPI
    from app.main import app
    from app.auth.dependencies import get_current_user
    
    async def override_get_current_user():
        return User(
            id="123e4567-e89b-12d3-a456-426614174000",
            username="testuser",
            email=test_user["email"],
            first_name=test_user["first_name"],
            last_name=test_user["last_name"],
            role=UserRole.USER,
            is_verified=True
        )
    
    app.dependency_overrides[get_current_user] = override_get_current_user
    
    # We also need to mock the RoleChecker since it checks roles
    from app.auth.dependencies import RoleChecker
    # Just bypassing the role checker by overriding it is complex due to classes,
    # so we mock the token verification instead if needed.
    
    with patch("app.auth.dependencies.AccessTokenBearer.__call__") as mock_bearer:
        mock_bearer.return_value = {"user": {"email": test_user["email"]}, "jti": "fake"}
        
        headers = {"Authorization": "Bearer faketoken"}
        response = await async_client.get("/auth/me", headers=headers)
        
        assert response.status_code == 200
        assert response.json()["email"] == test_user["email"]
        
    app.dependency_overrides.clear()
