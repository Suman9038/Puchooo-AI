import os
import sys
import asyncio
from celery import Celery

if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from app.core.config import settings
from app.core.mail import MailService
from app.rag_pipeline.indexing import VideoIndexingService
from asgiref.sync import async_to_sync
from uuid import UUID

def get_redis_url() -> str:
    for candidate in [
        os.getenv("UPSTASH_REDIS_URL"),
        os.getenv("REDIS_URL"),
        os.getenv("UPSTASH_REDIS_REST_URL"),
    ]:
        if candidate and (candidate.startswith("redis://") or candidate.startswith("rediss://")):
            return candidate
    return settings.LOCAL_REDIS_URL

redis_url = get_redis_url()

celery_app = Celery(
    "puchoooAI",
    broker=redis_url,
    backend=redis_url
)

@celery_app.task()
def send_verification_email_task(username:str,email:str,verification_url:str):
    async_to_sync(MailService.send_verification_email)(
        username=username,
        to_email=email,
        verification_url=verification_url
    )

@celery_app.task()
def send_welcome_email_task(username:str,to_email:str):
    async_to_sync(MailService.send_welcome_email)(
        username=username,
        to_email=to_email
    )

@celery_app.task()
def send_password_reset_email_task(username:str,email:str,reset_url:str):
    async_to_sync(MailService.send_password_reset_email)(
        username=username,
        to_email=email,
        reset_url=reset_url
    )

from app.core.database import sessionlocal

async def _run_index_video(video_id: UUID):
    async with sessionlocal() as db:
        service = VideoIndexingService()
        await service.index_video(db_video_id=video_id, db=db)

@celery_app.task()
def index_video_task(video_id: str):
    async_to_sync(_run_index_video)(UUID(video_id))
