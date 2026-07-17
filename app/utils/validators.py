import re
from fastapi import HTTPException, status

class PasswordValidator:
    @staticmethod
    def validate(password: str) -> None:
        if len(password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Password must be at least 8 characters long"
            )
        
        if not re.search(r"[A-Z]", password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Password must contain at least one uppercase letter"
            )
        
        if not re.search(r"[a-z]", password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Password must contain at least one lowercase letter"
            )
        
        if not re.search(r"[0-9]", password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Password must contain at least one number"
            )
        
        if not re.search(r"[!@#$%^&*]", password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Password must contain at least one special character"
            )

class EmailValidator:
    @staticmethod
    def validate(email: str) -> None:
        if not re.match(r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$", email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Invalid email address, Please Enter a valid email"
            )

class UsernameValidator:
    @staticmethod
    def validate(username: str, min_length: int = 3, max_length: int = 255) -> None:
        if len(username) < min_length or len(username) > max_length:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail=f"Username must be between {min_length} and {max_length} characters long"
            )