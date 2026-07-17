from app.core.logger import logger
from datetime import datetime, timedelta,timezone
from passlib.context import CryptContext
import jwt
from app.core.config import settings
import uuid
from app.core.exceptions import (
    InvalidToken,
    VerificationTokenInvalid,
    VerificationTokenExpired,
    PasswordResetTokenExpired,
    PasswordResetTokenInvalid,
    ExpiredToken
)
from itsdangerous import URLSafeTimedSerializer, SignatureExpired, BadSignature

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return pwd_context.verify(password, hashed_password)


def create_access_token(user_data: dict, expiry: timedelta | None = None, refresh:bool = False):
    try:
        # Setting default expiry if not provided
        if expiry is None:
            expiry = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

        # Setting up the payload
        payload={}
        payload["user"] = user_data
        payload["exp"] = datetime.now(timezone.utc) + expiry
        payload["jwt_id"] = str(uuid.uuid4())
        payload["refresh"] = refresh

        token = jwt.encode(
        payload = payload,
        key = settings.JWT_SECRET_KEY,
        algorithm= settings.JWT_ALGORITHM
    )
        return token
    except Exception as e:
        logger.error(f"Error generating token: {e}")
        return None

def decode_jwt(token:str)-> dict:
    try:
        token_data = jwt.decode(
            jwt= token,
            key= settings.JWT_SECRET_KEY,
            algorithms= [settings.JWT_ALGORITHM]
        )
        return token_data
    except jwt.ExpiredSignatureError:
        raise ExpiredToken() 
    except jwt.InvalidTokenError:
        raise InvalidToken()


serializer = URLSafeTimedSerializer(settings.JWT_SECRET_KEY, salt="email-configuration")
password_reset_serializer = URLSafeTimedSerializer(settings.JWT_SECRET_KEY, salt="password-reset")

def create_url_safe_token(data:dict):
    token = serializer.dumps(data)
    return token

def verify_url_safe_token(token:str):
    try:
        data = serializer.loads(token, max_age=3600)
        return data
    except SignatureExpired:
        raise VerificationTokenExpired()
    except BadSignature:
        raise VerificationTokenInvalid()

def create_password_reset_token(data:dict):
    reset_token = password_reset_serializer.dumps(data)
    return reset_token

def verify_password_reset_token(token:str):
    try:
        data = password_reset_serializer.loads(token, max_age=3600)
        return data
    except SignatureExpired:
        raise PasswordResetTokenExpired()
    except BadSignature:
        raise PasswordResetTokenInvalid()