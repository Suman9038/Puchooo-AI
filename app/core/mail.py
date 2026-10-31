import os
import logging
import httpx
from dotenv import load_dotenv
from app.core.config import settings
from jinja2 import Environment, FileSystemLoader, select_autoescape
from pathlib import Path
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig

load_dotenv()
logger = logging.getLogger(__name__)

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
    """Handle All mail related services with automatic multi-provider fallback"""

    template_dir = Path(__file__).parent.parent / "templates"
    env = Environment(
        loader=FileSystemLoader(Path(__file__).parent.parent / "templates"),
        autoescape=select_autoescape(["html", "xml"])
    )

    @classmethod
    def render_template(cls, template_name: str, context: dict) -> str:
        template = cls.env.get_template(template_name)
        return template.render(**context)

    @classmethod
    async def _send_via_smtp(cls, to_email: str, subject: str, html: str):
        message = MessageSchema(
            subject=subject,
            recipients=[to_email],
            body=html,
            subtype="html"
        )
        return await mail.send_message(message)

    @classmethod
    async def _send_via_resend(cls, to_email: str, subject: str, html: str):
        resend_api_key = os.getenv("RESEND_API_KEY")
        if not resend_api_key:
            raise ValueError("RESEND_API_KEY is not configured in environment")
        
        from_address = os.getenv("RESEND_FROM_EMAIL", f"{settings.MAIL_FROM_NAME} <onboarding@resend.dev>")
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {resend_api_key}",
                    "Content-Type": "application/json",
                    "User-Agent": "Puchooo-AI/1.0",
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

    @classmethod
    async def _send_via_brevo_api(cls, to_email: str, subject: str, html: str):
        brevo_api_key = os.getenv("BREVO_API_KEY")
        if not brevo_api_key:
            raise ValueError("BREVO_API_KEY is not configured in environment")

        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.post(
                "https://api.brevo.com/v3/smtp/email",
                headers={
                    "accept": "application/json",
                    "api-key": brevo_api_key,
                    "content-type": "application/json",
                },
                json={
                    "sender": {
                        "name": settings.MAIL_FROM_NAME,
                        "email": settings.MAIL_FROM,
                    },
                    "to": [{"email": to_email}],
                    "subject": subject,
                    "htmlContent": html,
                },
            )
            if response.status_code >= 400:
                raise Exception(f"Brevo email API error ({response.status_code}): {response.text}")
            return response.json()

    @classmethod
    async def send_mail(cls, to_email: str, subject: str, html: str):
        provider = os.getenv("EMAIL_PROVIDER", "auto").lower().strip()

        # 1. Direct explicit providers
        if provider == "resend":
            logger.info(f"[MailService] Sending email to {to_email} via Resend API")
            return await cls._send_via_resend(to_email, subject, html)
        if provider == "brevo_api":
            logger.info(f"[MailService] Sending email to {to_email} via Brevo API")
            return await cls._send_via_brevo_api(to_email, subject, html)
        if provider == "smtp":
            logger.info(f"[MailService] Sending email to {to_email} via SMTP")
            return await cls._send_via_smtp(to_email, subject, html)

        # 2. "auto" Mode: Brevo SMTP primary -> Automatic fallback to Resend API
        try:
            logger.info(f"[MailService] Attempting to send email to {to_email} via Primary SMTP (Brevo)...")
            return await cls._send_via_smtp(to_email, subject, html)
        except Exception as primary_err:
            logger.warning(
                f"[MailService] Primary SMTP delivery failed: {primary_err}. "
                f"Triggering automatic fallback to Resend API..."
            )
            if os.getenv("RESEND_API_KEY"):
                try:
                    resend_res = await cls._send_via_resend(to_email, subject, html)
                    logger.info(f"[MailService] Fallback to Resend API succeeded: {resend_res}")
                    return resend_res
                except Exception as fallback_err:
                    logger.error(f"[MailService] Fallback Resend API also failed: {fallback_err}")
                    raise Exception(
                        f"All email services failed. Primary SMTP error: {primary_err} | Fallback Resend error: {fallback_err}"
                    )
            # If no Resend API key is available, re-raise the primary error
            raise primary_err

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
