from pydantic import BaseModel, EmailStr, Field,ConfigDict
import uuid
from app.models.models import UserRole

class UserCreateSchema(BaseModel):
    username: str = Field(..., description="Enter Username")
    email: EmailStr = Field(..., description="Enter Email")
    password: str = Field(..., description="Password must be between 8 and 128 characters")
    first_name: str = Field(..., description="Enter First Name")
    last_name: str = Field(..., description="Enter Last Name")

class UserResponseSchema(BaseModel):
    id: uuid.UUID
    username: str
    email: EmailStr
    first_name: str
    last_name: str
    role: UserRole
    is_verified: bool


    model_config = ConfigDict(from_attributes=True)

class UserResponseSchemaWithMessage(BaseModel):
    message:str
    user: UserResponseSchema

class UserLoginSchema(BaseModel):
    email: EmailStr = Field(..., description="Enter Email")
    password: str = Field(..., description="Enter Password")

class TokenSchema(BaseModel):
    message: str
    access_token: str | None = None
    token_type: str = "bearer"
    refresh_token: str | None = None
    token_refresh_success: bool | None = None

class CurrentUserResponseSchema(UserResponseSchema):
    pass

class ChangePasswordSchema(BaseModel):
    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., description="New password must be between 8 and 128 characters")

class UpdateProfileSchema(BaseModel):
    username: str | None = None
    first_name: str | None = None
    last_name: str | None = None