from sqlalchemy import select
from fastapi import Depends
from fastapi.security import HTTPBearer
from fastapi.security.http import HTTPAuthorizationCredentials
from fastapi import Request
from app.auth.utils import decode_jwt
from app.core.redis import token_in_blocklist
from app.core.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Any
from app.models.models import User, UserRole
from app.core.exceptions import(
    InvalidToken,
    RevokedToken,
    RefreshTokenRequired,
    AccessTokenRequired,
    UserNotExists,
    InsufficentPermission,
    AccountNotVerified,
)

class TokenBearer(HTTPBearer):
    # This is basically we are overwriting the __init__ method of HTTPBearer class
    # so that we can add our own custom logic to it like here we kept auto_error = True so that if any error occurs it will raise an HTTP 401 error if we keep false then it will not show error
    def __init__(self, auto_error: bool = True):
        super().__init__(auto_error=auto_error)

    # Overwriting the __call__ method of HTTPBearer class
    # Here we will able to access the access token and will able to work on it as well as the refresh token
    # Ye sabse important method hai Dependency use hone par ye method automatically execute hota hai
    async def __call__(self, request: Request)-> HTTPAuthorizationCredentials | None:
        # Extract Credentials
        creds = await super().__call__(request)

        if not creds:
            raise InvalidToken()

        token = creds.credentials
        
        # decode_jwt will automatically raise InvalidToken or ExpiredToken if it fails
        token_data = decode_jwt(token)

        if await token_in_blocklist(token_data["jwt_id"]):
            raise RevokedToken()

        self.verify_token_data(token_data)

        return token_data

    def token_valid(self, token:str)-> bool :
        token_data = decode_jwt(token)

        if token_data is None:
           return False
        return True

    def verify_token_data(self, token_data):
        raise NotImplementedError("Subclasses must implement this method")

# Sirf access token allow karta hai
class AccessTokenBearer(TokenBearer):
    def verify_token_data(self, token_data:dict) -> None:
        if token_data and token_data["refresh"]:
            raise AccessTokenRequired()

# Sirf refresh token allow karta hai
class RefreshTokenBearer(TokenBearer):
    def verify_token_data(self, token_data:dict) -> None:
        if token_data and not token_data["refresh"]:
            raise RefreshTokenRequired() 

async def get_current_user(token_details:dict= Depends(AccessTokenBearer()), db: AsyncSession = Depends(get_db)):
    user_id = token_details["user"]["id"]

    user = await db.execute(select(User).where(User.id == user_id))
    user = user.scalar_one_or_none()

    if user is None:
        raise UserNotExists()
    return user


class RoleChecker:
    def __init__(self, allowed_roles: List[UserRole]) -> None:
        self.allowed_roles = set(allowed_roles)

    async def __call__(self, current_user:User = Depends(get_current_user)) -> Any:
        if not current_user.is_verified:
            raise AccountNotVerified()
        
        if current_user.role in self.allowed_roles:
            return current_user
        
        raise InsufficentPermission()

    