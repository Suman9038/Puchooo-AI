from fastapi import APIRouter, Depends,status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.logger import logger
from app.models.models import UserRole
from app.auth.auth_schemas import (
    UserCreateSchema, UserResponseSchema, UserLoginSchema,
    TokenSchema, UserResponseSchemaWithMessage, CurrentUserResponseSchema,
    ChangePasswordSchema, UpdateProfileSchema
)
from app.auth.dependencies import AccessTokenBearer, RefreshTokenBearer, RoleChecker, get_current_user
from app.auth.auth_service import AuthService
from app.schemas.mail_schema import ResendVerificationSchema, ResetPasswordSchema, ForgotPasswordSchema
from app.core.redis import rate_limit_auth
from app.core.mail import MailService

router = APIRouter(
    prefix="/auth",
    tags=["Authentication"]
)

access_token_bearer = AccessTokenBearer()
refresh_token_bearer = RefreshTokenBearer()
role_checker = RoleChecker([UserRole.ADMIN, UserRole.USER])
admin_role_checker = RoleChecker([UserRole.ADMIN])


@router.post("/signup", response_model=UserResponseSchemaWithMessage, status_code=status.HTTP_201_CREATED)
async def signup(request: UserCreateSchema, db: AsyncSession = Depends(get_db), _: None = Depends(rate_limit_auth)):
    logger.info(f"Attempted signup for user {request.email}")
    new_user = await AuthService.signup(request, UserRole.USER, db)
    return {
        "message": "Account Created! Now check your email to verify your account!",
        "user": new_user
    }


@router.get("/verify-email", status_code=status.HTTP_200_OK)
async def verify_email(token: str, db: AsyncSession = Depends(get_db)):
    return await AuthService.verify_email(token, db)


@router.post("/signup/admin", response_model=UserResponseSchema, status_code=status.HTTP_201_CREATED)
async def signup_admin(
    request: UserCreateSchema, 
    db: AsyncSession = Depends(get_db),
    admin_user = Depends(get_current_user), # Requires user to be logged in
    _: bool = Depends(admin_role_checker),   # Requires user to have ADMIN role
    __: None = Depends(rate_limit_auth)
):
    logger.info(f"Admin {admin_user.email} is creating a new admin account for {request.email}")
    return await AuthService.signup(request, UserRole.ADMIN, db)


@router.post("/login", response_model=TokenSchema)
async def login(request: UserLoginSchema, db: AsyncSession = Depends(get_db), _: None = Depends(rate_limit_auth)):
    logger.info(f"Attempting login for user {request.email}")
    return await AuthService.login(request, db)


@router.get("/refresh_token", response_model=TokenSchema)
async def refresh_access_token(token_details: dict = Depends(refresh_token_bearer)):
    return AuthService.refresh_access_token(token_details)


@router.get("/me", response_model=CurrentUserResponseSchema)
async def get_me(user = Depends(get_current_user), _: bool = Depends(role_checker)):
    return user


@router.get("/logout")
async def logout(token_details: dict = Depends(access_token_bearer)):
    await AuthService.logout(token_details["jwt_id"])
    return JSONResponse(
        content={"message": "Logged Out Successfully"},
        status_code=status.HTTP_200_OK
    )


@router.post("/resend-verification")
async def resend_verification(request: ResendVerificationSchema, db: AsyncSession = Depends(get_db), _: None = Depends(rate_limit_auth)):
    return await AuthService.resend_verification(request.email, db)


@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordSchema, db: AsyncSession = Depends(get_db), _: None = Depends(rate_limit_auth)):
    return await AuthService.forgot_password(request.email, db)


@router.post("/reset-password")
async def reset_password(request: ResetPasswordSchema, db: AsyncSession = Depends(get_db), _: None = Depends(rate_limit_auth)):
    return await AuthService.reset_password(request.token, request.new_password, db)


@router.post("/change-password")
async def change_password(
    request: ChangePasswordSchema, 
    db: AsyncSession = Depends(get_db),
    user = Depends(get_current_user)
):
    return await AuthService.change_password(user, request.current_password, request.new_password, db)


@router.patch("/update-profile")
async def update_profile(
    request: UpdateProfileSchema,
    db: AsyncSession = Depends(get_db),
    user = Depends(get_current_user)
):
    return await AuthService.update_profile(user, request.model_dump(exclude_unset=True), db)


@router.get("/test-email")
async def test_email():
    await MailService.send_mail(
        to_email="reversed713@gmail.com",
        subject="SMTP Test",
        html="<h1>Hello from Puchooo AI</h1>"
    )
    return {"message": "Email sent"}