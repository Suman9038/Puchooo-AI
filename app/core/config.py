from pydantic_settings import BaseSettings,SettingsConfigDict
from dotenv import load_dotenv
from pathlib import Path

DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    # Local Database
    LOCAL_DATABASE_URL:str
    ALEMBIC_DATABASE_URL:str

    # Local Qdrant 
    QDRANT_HOST:str
    QDRANT_PORT:int
    QDRANT_COLLECTION:str
    LOCAL_QDRANT_URL:str
    EMBEDDING_DIMENSION:int

    # Redis Local
    REDIS_HOST:str
    REDIS_PORT:int
    LOCAL_REDIS_URL:str

    # JWT 
    JWT_SECRET_KEY:str
    JWT_ALGORITHM:str
    ACCESS_TOKEN_EXPIRE_MINUTES:int
    REFRESH_TOKEN_EXPIRE_DAYS:int

    # Email SMTP
    VERIFICATION_URL:str
    MAIL_USERNAME:str
    MAIL_PASSWORD:str
    MAIL_FROM:str
    MAIL_PORT:int
    MAIL_SERVER:str
    MAIL_FROM_NAME:str
    MAIL_STARTTLS:bool
    MAIL_SSL_TLS:bool

    # Google
    GOOGLE_API_KEY:str

    # HuggingFace
    HUGGINGFACEHUB_ACCESS_TOKEN:str

    # OpenRouter
    OPENROUTER_API_KEY:str

    # Groq
    GROQ_API_KEY:str




    model_config= SettingsConfigDict(
        env_file=DIR / ".env",
        extra = "ignore"
    )

settings= Settings()