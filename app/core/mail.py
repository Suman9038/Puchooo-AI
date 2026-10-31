import os
import httpx
from dotenv import load_dotenv
from app.core.config import settings
from jinja2 import Environment, FileSystemLoader, select_autoescape
from pathlib import Path
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig

load_dotenv()

config = ConnectionConfig(
    MAIL_USERNAME=settings.MAIL_USERNAME,
    MAIL_PASSWORD=settings.MAIL_PASSWORD,
    MAIL_FROM=settings.MAIL_FROM,
    MAIL_PORT=settings.MAIL_PORT,
    MAIL_SERVER=settings.MAIL_SERVER,
    MAIL_FROM_NAME=settings.MAIL_FROM_NAME,
    MAIL_STARTTLS=settings.MAIL_STARTTLS,
    MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True,
    TEMPLATE_FOLDER=Path(__file__).parent.parent / "templates"
)

mail = FastMail(config)


class MailService:
    """Handle All mail related services"""

    template_dir = Path(__file__).parent.parent / "templates"
    env = Environment(
        loader=FileSystemLoader(Path(__file__).parent.parent / "templates"),
        autoescape=select_autoescape(["html", "xml"])
    )

    @classmethod
    def render_template(cls, template_name: str, context: dict) -> str:
        template = cls.env.get_template(template_name)
        return template.render(**context)

    @staticmethod
    async def send_mail(to_email: str, subject: str, html: str):
        # 1. Check for HTTP-based Email API (Resend)
        # Cloud platforms like Render Free tier strictly block traditional SMTP ports (25, 465, 587).
        # HTTP APIs operate over Port 443 (HTTPS) and are never blocked.
        resend_api_key = os.getenv("RESEND_API_KEY")
        if resend_api_key:
            from_address = os.getenv("RESEND_FROM_EMAIL", f"{settings.MAIL_FROM_NAME} <onboarding@resend.dev>")
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(
                    "https://api.resend.com/emails",
                    headers={
                        "Authorization": f"Bearer {resend_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "from": from_address,
                        "to": [to_email],
                        "subject": subject,
                        "html": html,
                    },
                )
                if response.status_code >= 400:
                    raise Exception(f"Resend email API error ({response.status_code}): {response.text}")
                return response.json()

        # 2. Fallback to standard SMTP (Local development or unblocked servers)
        message = MessageSchema(
            subject=subject,
            recipients=[to_email],
            body=html,
            subtype="html"
        )

        return await mail.send_message(message)

    @classmethod
    async def send_verification_email(cls, username: str, to_email: str, verification_url: str):
        html = cls.render_template(
            "verify_email.html",
            {
                "username": username,
                "verification_url": verification_url
            },
        )

        return await cls.send_mail(
            to_email=to_email,
            subject="Verify Your Email - Puchooo AI",
            html=html
        )

    @classmethod
    async def send_welcome_email(cls, username: str, to_email: str):
        html = cls.render_template(
            "welcome.html",
            {
                "username": username
            },
        )

        return await cls.send_mail(
            to_email=to_email,
            subject="Welcome to Puchooo AI",
            html=html
        )

    @classmethod
    async def send_password_reset_email(cls, username: str, to_email: str, reset_url: str):
        html = cls.render_template(
            "password_reset.html",
            {
                "username": username,
                "reset_url": reset_url
            },
        )

        return await cls.send_mail(
            to_email=to_email,
            subject="Reset Your Password - Puchooo AI",
            html=html
        )
