import asyncio
import pytest
import pytest_asyncio
import asyncpg
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from typing import AsyncGenerator

from app.main import app
from app.core.database import Base, get_db
from app.core.config import settings

# Test Database Name
TEST_DB_NAME = "puchoooai_test"
BASE_URL = settings.LOCAL_DATABASE_URL.rsplit('/', 1)[0]
TEST_DB_URL = f"{BASE_URL}/{TEST_DB_NAME}"

# Fixture to manage the database lifecycle (Create before tests, Drop after)
@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_test_db():
    # Parse base URL to connect via asyncpg to the default 'postgres' database
    db_url = settings.LOCAL_DATABASE_URL
    # We replace '+asyncpg' with '' for asyncpg connection string
    asyncpg_url = db_url.replace('+asyncpg', '')
    base_pg_url = asyncpg_url.rsplit('/', 1)[0] + "/postgres"

    # Connect to default DB to create test DB
    try:
        conn = await asyncpg.connect(base_pg_url)
        # Drop test db if exists from a previous failed run
        await conn.execute(f'DROP DATABASE IF EXISTS {TEST_DB_NAME} (FORCE)')
        # Create fresh test DB
        await conn.execute(f'CREATE DATABASE {TEST_DB_NAME}')
        await conn.close()
    except Exception as e:
        print(f"Error creating test database: {e}")

    # Create engine for the test DB to create tables
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    await engine.dispose()

    yield  # Run the tests!

    # Cleanup: Drop the test database
    try:
        conn = await asyncpg.connect(base_pg_url)
        await conn.execute(f'DROP DATABASE IF EXISTS {TEST_DB_NAME} (FORCE)')
        await conn.close()
    except Exception as e:
        print(f"Error dropping test database: {e}")


@pytest_asyncio.fixture(scope="function")
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provides a fresh database session for each test."""
    engine = create_async_engine(TEST_DB_URL, echo=False)
    TestingSessionLocal = sessionmaker(
        class_=AsyncSession, autocommit=False, autoflush=False, bind=engine
    )

    async with TestingSessionLocal() as session:
        yield session

    await engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def async_client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Provides a FastAPI test client with the database dependency overridden."""
    # Override the get_db dependency
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        yield client

    app.dependency_overrides.clear()
