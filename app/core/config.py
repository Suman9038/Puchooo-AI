from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv
from pathlib import Path

DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    # Database
    LOCAL_DATABASE_URL: str
    ALEMBIC_DATABASE_URL: str

    # Qdrant 
    QDRANT_HOST: str = "localhost"
    QDRANT_PORT: int = 6333
    QDRANT_COLLECTION: str = "Puchooo_AI"
    LOCAL_QDRANT_URL: str = "http://localhost:6333"
    EMBEDDING_DIMENSION: int = 768

    # Redis
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    LOCAL_REDIS_URL: str = "redis://localhost:6379/0"

    # JWT 
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int
    REFRESH_TOKEN_EXPIRE_DAYS: int

    # Email SMTP
    VERIFICATION_URL: str
    MAIL_USERNAME: str
    MAIL_PASSWORD: str
    MAIL_FROM: str
    MAIL_PORT: int
    MAIL_SERVER: str
    MAIL_FROM_NAME: str
    MAIL_STARTTLS: bool
    MAIL_SSL_TLS: bool

    # Google
    GOOGLE_API_KEY: str

    # HuggingFace
    HUGGINGFACEHUB_ACCESS_TOKEN: str

    # OpenRouter
    OPENROUTER_API_KEY: str

    # Groq
    GROQ_API_KEY: str

    model_config = SettingsConfigDict(
        env_file=DIR / ".env",
        extra="ignore"
    )

settings = Settings()
