import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status
from datetime import timedelta, datetime, timezone
from app.models.models import User, UserRole
from app.auth.auth_schemas import UserCreateSchema, UserLoginSchema, TokenSchema
from app.auth.utils import (
    hash_password, verify_password, create_access_token,
    create_url_safe_token, verify_url_safe_token,
    create_password_reset_token, verify_password_reset_token
)
from app.core.config import settings
from app.core.redis import add_token_jti_to_blocklist, set_email_cooldown, email_cooldown_active
from app.worker.celery import send_verification_email_task, send_welcome_email_task, send_password_reset_email_task
from app.core.exceptions import (
    UserAlreadyExists, UserNotExists, InvalidCredentials,
    TokenGenerationFailed, InvalidToken, EmailCooldownActive,
    AccountNotVerified
)
from app.repositories.user_repository import UserRepository
from app.utils.validators import EmailValidator, PasswordValidator, UsernameValidator


class AuthService:
    """
    Handles all business logic for Authentication.
    Acts as a bridge between HTTP Routes and the User Repository.
    """

    @staticmethod
    async def signup(request: UserCreateSchema, role: UserRole, db: AsyncSession) -> User:
        # Validation
        EmailValidator.validate(request.email)
        PasswordValidator.validate(request.password)
        UsernameValidator.validate(request.username)

        existing_user = await UserRepository.get_user_by_email(request.email, db)
        if existing_user:
            raise UserAlreadyExists()
        
        user_data = request.model_dump()
        new_user = User(**user_data)
        new_user.password = await asyncio.to_thread(hash_password, user_data["password"])
        new_user.role = role

        new_user = await UserRepository.create_user(new_user, db)

        token = create_url_safe_token({"email": new_user.email})
        verification_url = settings.VERIFICATION_URL.format(token=token)

        send_verification_email_task.delay(
            username=new_user.first_name,
            email=new_user.email,
            verification_url=verification_url
        )
        return new_user

    @staticmethod
    async def login(request: UserLoginSchema, db: AsyncSession) -> TokenSchema:
        user = await UserRepository.get_user_by_email(request.email, db)
        if not user:
            raise UserNotExists()

        if not await asyncio.to_thread(verify_password, request.password, user.password):
            raise InvalidCredentials()

        if not user.is_verified:
            raise AccountNotVerified()

        user_data = {
            "id": str(user.id),
            "email": user.email,
            "username": user.username,
            "role": user.role,
            "is_verified": user.is_verified
        }
        
        access_token = create_access_token(user_data)
        refresh_token = create_access_token(
            user_data,
            refresh=True,
            expiry=timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
        )

        if not access_token or not refresh_token:
            raise TokenGenerationFailed()

        return TokenSchema(
            message="Login Successful",
            access_token=access_token,
            token_type="bearer",
            refresh_token=refresh_token
        )

    @staticmethod
    def refresh_access_token(token_details: dict) -> TokenSchema:
        expiry_timestamp = token_details["exp"]
        
        if datetime.fromtimestamp(expiry_timestamp, tz=timezone.utc) > datetime.now(timezone.utc):
            new_access_token = create_access_token(user_data=token_details["user"])
            return TokenSchema(
                message="Token Refreshed Successfully",
                access_token=new_access_token,
                token_type="bearer",
                token_refresh_success=token_details["refresh"]
            )
        raise InvalidToken()

    @staticmethod
    async def verify_email(token: str, db: AsyncSession) -> dict:
        data = verify_url_safe_token(token)
        email = data.get("email")
        if not email:
            raise InvalidToken()

        user = await UserRepository.get_user_by_email(email, db)
        if not user:
            raise UserNotExists()

        if user.is_verified:
            return {"message": "User is already verified"}

        # Uses the verify_user method you created in user_repository
        user = await UserRepository.verify_user(user, db)

        send_welcome_email_task.delay(
            username=user.first_name,
            to_email=user.email
        )
        return {"message": "Email verified successfully"}

    @staticmethod
    async def logout(jwt_id: str) -> None:
        await add_token_jti_to_blocklist(jwt_id)

    @staticmethod
    async def resend_verification(email: str, db: AsyncSession) -> dict:
        user = await UserRepository.get_user_by_email(email, db)
        if not user:
            raise UserNotExists()

        if user.is_verified:
            return {"message": "Email is already Verified"}

        if await email_cooldown_active(str(user.id)):
            raise EmailCooldownActive()

        token = create_url_safe_token({"email": user.email})
        verification_url = settings.VERIFICATION_URL.format(token=token)

        send_verification_email_task.delay(
            username=user.first_name,
            email=user.email,
            verification_url=verification_url
        )
        await set_email_cooldown(str(user.id))
        return {"message": "Verification email sent successfully"}

    @staticmethod
    async def forgot_password(email: str, db: AsyncSession) -> dict:
        user = await UserRepository.get_user_by_email(email, db)
        if not user:
            raise UserNotExists()

        if await email_cooldown_active(str(user.id)):
            raise EmailCooldownActive()

        token = create_password_reset_token({"email": user.email})
        password_reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"

        send_password_reset_email_task.delay(
            username=user.first_name,
            email=user.email,
            reset_url=password_reset_url
        )
        await set_email_cooldown(str(user.id))
        return {"message": "Password reset email sent successfully"}

    @staticmethod
    async def reset_password(token: str, new_password: str, db: AsyncSession) -> dict:
        token_data = verify_password_reset_token(token)
        user = await UserRepository.get_user_by_email(token_data["email"], db)
        if not user:
            raise UserNotExists()
        PasswordValidator.validate(new_password)

        hashed_pw = await asyncio.to_thread(hash_password, new_password)
        # Uses the update_password method you created in user_repository
        await UserRepository.update_password(user, hashed_pw, db)

        return {"message": "Password reset successful"}

    @staticmethod
    async def change_password(user: User, current_password: str, new_password: str, db: AsyncSession) -> dict:
        if not await asyncio.to_thread(verify_password, current_password, user.password):
            raise InvalidCredentials()

        PasswordValidator.validate(new_password)
        hashed_pw = await asyncio.to_thread(hash_password, new_password)
        
        await UserRepository.update_password(user, hashed_pw, db)

        return {"message": "Password changed successfully"}
    @staticmethod
    async def update_profile(user: User, data: dict, db: AsyncSession) -> dict:
        try:
            if data.get("username"):
                user.username = data["username"]
            if data.get("first_name"):
                user.first_name = data["first_name"]
            if data.get("last_name"):
                user.last_name = data["last_name"]
            
            await UserRepository.update_user(user, db)
            return {
                "message": "Profile updated successfully",
                "user": user
            }
        except IntegrityError:
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username is already taken"
            )
