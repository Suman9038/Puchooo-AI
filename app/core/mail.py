from dotenv import load_dotenv
from app.core.config import settings
from jinja2 import Environment,FileSystemLoader,select_autoescape
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
    TEMPLATE_FOLDER=Path(__file__).parent.parent/ "templates"
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
    def render_template(cls, template_name:str, context: dict)-> str:
        template = cls.env.get_template(template_name)
        return template.render(**context)


    @staticmethod
    async def send_mail(to_email:str,subject:str,html:str):
        message = MessageSchema(
            subject=subject,
            recipients=[to_email],
            body=html,
            subtype="html"
        )

        return await mail.send_message(message)

    @classmethod
    async def send_verification_email(cls, username:str, to_email:str, verification_url:str):

        html = cls.render_template(
            "verify_email.html",
            {
                "username":username,
                "verification_url":verification_url
            },
        )

        return await cls.send_mail(
            to_email=to_email,
            subject="Verify Your Email - Puchooo AI",
            html = html
        )

    @classmethod
    async def send_welcome_email(cls, username:str, to_email:str):
        html = cls.render_template(
            "welcome.html",
            {
                "username":username
            },
        )

        return await cls.send_mail(
            to_email=to_email,
            subject="Welcome to Puchooo AI",
            html=html
        )

    @classmethod
    async def send_password_reset_email(cls, username:str, to_email:str, reset_url:str):
        html = cls.render_template(
            "password_reset.html",
            {
                "username":username,
                "reset_url":reset_url
            },
        )

        return await cls.send_mail(
            to_email=to_email,
            subject="Reset Your Password - Puchooo AI",
            html=html
        )

