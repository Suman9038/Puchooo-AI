from fastapi import FastAPI, status
from typing import Any, Callable
from fastapi.requests import Request
from fastapi.responses import JSONResponse

class PuchoooAIException(Exception):
    """
    Base class for all exceptions in the PuchoooAI app
    """
    def __init__(self, message: str | None = None, status_code: int = 400):
        self.message = message
        self.status_code = status_code

    def __str__(self) -> str:
        if self.message:
            return self.message
        return "An error occurred"

class InvalidToken(PuchoooAIException):
    """
    Custom exception for invalid tokens.
    """
    pass

class RevokedToken(PuchoooAIException):
    """
    User has provided a token that has been revoked.
    """
    pass

class AccessTokenRequired(PuchoooAIException):
    """
    User has provided a refresh token when an access token is required.
    """
    pass

class RefreshTokenRequired(PuchoooAIException):
    """
    User has provided an access token when a refresh token is required.
    """
    pass

class UserAlreadyExists(PuchoooAIException):
    """
    User has provided an email for that a user with same email already exists.
    """
    pass

class UserNotExists(PuchoooAIException):
    """
    User has provided an email for that a user with same email not exists.
    """
    pass

class TokenGenerationFailed(PuchoooAIException):
    """
    An Error Occured while generating token.
    """
    pass

class InvalidCredentials(PuchoooAIException):
    """
    User has provided a email or password that is not valid.
    """
    pass

class InsufficentPermission(PuchoooAIException):
    """
    User does not have the neccessary permissions to perform an action.
    """
    pass

class VerificationTokenExpired(PuchoooAIException):
    """
    When the verification token is expired
    """
    pass

class VerificationTokenInvalid(PuchoooAIException):
    pass

class EmailCooldownActive(PuchoooAIException):
    """If user send verification email more than 3 set as coooldown"""
    pass

class PasswordResetTokenExpired(PuchoooAIException):
    """When the password reset token is expired"""
    pass

class PasswordResetTokenInvalid(PuchoooAIException):
    """When the password reset token is invalid"""
    pass

class AccountNotVerified(PuchoooAIException):
    """
    User has not verified their account.
    """
    pass

class ConversationNotFound(PuchoooAIException):
    """
    Conversation not found
    """
    pass

class InvalidYoutubeURL(PuchoooAIException):
    """
    Invalid Youtube URL
    """
    pass

class InvalidYoutubeVideoID(PuchoooAIException):
    """
    Invalid Youtube Video ID
    """
    pass

class VideoAlreadyExistError(PuchoooAIException):
    """
    Video already exists
    """
    pass

class ExpiredToken(PuchoooAIException):
    """
    Token is expired
    """
    pass

class VideoNotFound(PuchoooAIException):
    """
    Video not found in database.
    """
    pass


def create_exception_handler(status_code: int, initial_detail: Any) -> Callable[[Request, Exception], JSONResponse]:
    
    async def exception_handler(request:Request, exc:PuchoooAIException):
        return JSONResponse(
            status_code=status_code,
            content={
               **initial_detail,
               "detail": exc.message if exc.message else initial_detail.get("message", "An error occurred")
            }
        )
    return exception_handler

def register_exception_handlers(app: FastAPI):
    app.add_exception_handler(
        UserAlreadyExists,
        create_exception_handler(
            status_code=status.HTTP_403_FORBIDDEN,
            initial_detail={
                "message":"User with Email already exists",
                "error_code": "ERR_USER_ALREADY_EXISTS"
            }
        )
    )

    app.add_exception_handler(
        UserNotExists,
        create_exception_handler(
            status_code=status.HTTP_403_FORBIDDEN,
            initial_detail={
                "message":"User with Email not exists",
                "error_code": "ERR_USER_NOT_EXISTS"
            }
        )
    )

    app.add_exception_handler(
        TokenGenerationFailed,
        create_exception_handler(
            status_code=status.HTTP_400_BAD_REQUEST,
            initial_detail={
                "message":"Token Generation Failed",
                "error_code": "ERR_TOKEN_GENERATION_FAILED"
            }
        )
    )

    app.add_exception_handler(
        InvalidCredentials,
        create_exception_handler(
            status_code=status.HTTP_401_UNAUTHORIZED,
            initial_detail={
                "message":"Invalid email or password",
                "error_code": "ERR_INVALID_CREDENTIALS"
            }
        )
    )

    app.add_exception_handler(
        InsufficentPermission,
        create_exception_handler(
            status_code=status.HTTP_403_FORBIDDEN,
            initial_detail={
                "message":"You don't have permission to perform this action",
                "error_code": "ERR_INSUFFICIENT_PERMISSION"
            }
        )
    )

    app.add_exception_handler(
        InvalidToken,
        create_exception_handler(
            status_code=status.HTTP_401_UNAUTHORIZED,
            initial_detail={
                "message":"Token is Invalid or expired",
                "error_code": "ERR_INVALID_TOKEN"
            }
        )
    )
    app.add_exception_handler(
        RevokedToken,
        create_exception_handler(
            status_code=status.HTTP_401_UNAUTHORIZED,
            initial_detail={
                "message":"Token is invalid or has been revoked",
                "error_code": "ERR_REVOKED_TOKEN"
            }
        )
    )  

    app.add_exception_handler(
        AccessTokenRequired,
        create_exception_handler(
            status_code=status.HTTP_401_UNAUTHORIZED,
            initial_detail={
                "message":"Please provide a valid access token. A refresh token was provided instead.",
                "error_code": "ERR_ACCESS_TOKEN_REQUIRED"
            }
        )
    )

    app.add_exception_handler(
        RefreshTokenRequired,
        create_exception_handler(
            status_code=status.HTTP_401_UNAUTHORIZED,
            initial_detail={
                "message":"Please provide a valid refresh token. An access token was provided instead.",
                "error_code": "ERR_REFRESH_TOKEN_REQUIRED"
            }
        )
    )

    app.add_exception_handler(
        VerificationTokenExpired,
        create_exception_handler(
            status_code=status.HTTP_401_UNAUTHORIZED,
            initial_detail={
                "message":"The Verification token is expired, Kindly click on resend email to get the new verification mail",
                "error_code": "ERR_VERIFICATION_TOKEN_EXPIRED"
            }
        )
    )
    app.add_exception_handler(
        VerificationTokenInvalid,
        create_exception_handler(
            status_code=status.HTTP_401_UNAUTHORIZED,
            initial_detail={
                "message":"Verification token is Invalid",
                "error_code": "ERR_VERIFICATION_TOKEN_INVALID"
            }
        )
    )
    app.add_exception_handler(
        EmailCooldownActive,
        create_exception_handler(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            initial_detail={
                "message":"Please wait before requesting another email.",
                "error_code": "ERR_EMAIL_SET_TO_COOLDOWN"
            }
        )
    )
    app.add_exception_handler(
        PasswordResetTokenExpired,
        create_exception_handler(
            status_code=status.HTTP_401_UNAUTHORIZED,
            initial_detail={
                "message":"The Password Reset token is expired, Kindly click on forgot password to get the new reset mail",
                "error_code": "ERR_PASSWORD_RESET_TOKEN_EXPIRED"
            }
        )
    )
    app.add_exception_handler(
        PasswordResetTokenInvalid,
        create_exception_handler(
            status_code=status.HTTP_401_UNAUTHORIZED,
            initial_detail={
                "message":"Password Reset token is Invalid",
                "error_code": "ERR_PASSWORD_RESET_TOKEN_INVALID"
            }
        )
    )
    app.add_exception_handler(
        AccountNotVerified,
        create_exception_handler(
            status_code=status.HTTP_403_FORBIDDEN,
            initial_detail={
                "message":"Your account is not verified, please verify your account",
                "error_code": "ERR_ACCOUNT_NOT_VERIFIED"
            }
        )
    )
    app.add_exception_handler(
        ConversationNotFound,
        create_exception_handler(
            status_code=status.HTTP_404_NOT_FOUND,
            initial_detail={
                "message":"Conversation not found",
                "error_code": "ERR_CONVERSATION_NOT_FOUND"
            }
        )
    )
    app.add_exception_handler(
        InvalidYoutubeURL,
        create_exception_handler(
            status_code=status.HTTP_400_BAD_REQUEST,
            initial_detail={
                "message":"Invalid Youtube URL",
                "error_code": "ERR_INVALID_YOUTUBE_URL"
            }
        )
    )
    app.add_exception_handler(
        InvalidYoutubeVideoID,
        create_exception_handler(
            status_code=status.HTTP_400_BAD_REQUEST,
            initial_detail={
                "message":"Invalid Youtube Video ID",
                "error_code": "ERR_INVALID_YOUTUBE_VIDEO_ID"
            }
        )
    )
    app.add_exception_handler(
        VideoAlreadyExistError,
        create_exception_handler(
            status_code=status.HTTP_400_BAD_REQUEST,
            initial_detail={
                "message":"Video already exists",
                "error_code": "ERR_VIDEO_ALREADY_EXIST"
            }
        )
    )
    app.add_exception_handler(
        ExpiredToken,
        create_exception_handler(
            status_code=status.HTTP_401_UNAUTHORIZED,
            initial_detail={
                "message":"Token is expired",
                "error_code": "ERR_EXPIRED_TOKEN"
            }
        )
    )
    app.add_exception_handler(
        VideoNotFound,
        create_exception_handler(
            status_code=status.HTTP_404_NOT_FOUND,
            initial_detail={
                "message":"Video not found",
                "error_code": "ERR_VIDEO_NOT_FOUND"
            }
        )
    )
