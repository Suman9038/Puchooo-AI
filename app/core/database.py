from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from app.core.config import settings


engine = create_async_engine(settings.LOCAL_DATABASE_URL, echo=False)

sessionlocal= sessionmaker(class_=AsyncSession, autoflush=False, autocommit=False, bind=engine, expire_on_commit=False)

Base = declarative_base()

async def get_db():
    async with sessionlocal() as db:
        yield db