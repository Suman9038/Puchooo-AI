import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

# Support Cloud (Neon/Postgres) or Local PostgreSQL with auto-normalization for asyncpg
db_url = os.getenv("NEON_CONN_STRING") or os.getenv("DATABASE_URL") or settings.LOCAL_DATABASE_URL
if "sslmode=" in db_url:
    db_url = db_url.replace("sslmode=require", "ssl=require").replace("&channel_binding=require", "")

engine = create_async_engine(
    db_url,
    pool_size=20,
    max_overflow=10,
    pool_timeout=30,
    pool_recycle=1800,
    pool_pre_ping=True,
    echo=False
)

sessionlocal = sessionmaker(
    class_=AsyncSession,
    autoflush=False,
    autocommit=False,
    bind=engine,
    expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    async with sessionlocal() as db:
        yield db
