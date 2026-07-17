from pydantic import BaseModel,EmailStr


class EmailRequestSchema(BaseModel):
    """Request body for sending emails"""
    to_email: str
    subject: str
    html: str

class ResendVerificationSchema(BaseModel):
    email: EmailStr

class ForgotPasswordSchema(BaseModel):
    email: EmailStr

class ResetPasswordSchema(BaseModel):
    token: str
    new_password: str