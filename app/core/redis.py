import os
import redis.asyncio as redis
from app.core.config import settings
from app.core.logger import logger
from fastapi import Request, HTTPException, status


JTI_EXPIRY = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60

# Cloud Redis (Upstash) vs Local Redis support
def get_redis_url() -> str:
    url = None
    for candidate in [
        getattr(settings, "REDIS_URL", None),
        getattr(settings, "UPSTASH_REDIS_URL", None),
        os.getenv("UPSTASH_REDIS_URL"),
        os.getenv("REDIS_URL"),
        os.getenv("UPSTASH_REDIS_REST_URL"),
    ]:
        if candidate and (candidate.startswith("redis://") or candidate.startswith("rediss://")):
            url = candidate
            break
    if not url:
        url = settings.LOCAL_REDIS_URL

    # Auto-fix for Celery & Redis TLS: If rediss:// is used, ensure ssl_cert_reqs parameter is present
    if url and url.startswith("rediss://") and "ssl_cert_reqs" not in url:
        separator = "&" if "?" in url else "?"
        url = f"{url}{separator}ssl_cert_reqs=none"

    return url

redis_url = get_redis_url()
logger.info(f"Connecting Redis client to: {redis_url.split('@')[-1] if '@' in redis_url else redis_url}")

redis_client = redis.from_url(
    redis_url,
    decode_responses=True,
    socket_timeout=10.0,
    socket_connect_timeout=10.0,
    retry_on_timeout=True,
    health_check_interval=30,
)


async def add_token_jti_to_blocklist(jwt_id: str):
    try:
        await redis_client.set(
            name=f"block_{jwt_id}",
            value="blocked",
            ex=JTI_EXPIRY,
        )
    except Exception as e:
        logger.warning(f"Failed to add token to blocklist: {e}")

async def token_in_blocklist(jwt_id: str) -> bool:
    try:
        return await redis_client.exists(f"block_{jwt_id}")
    except Exception as e:
        logger.warning(f"Failed to check token in blocklist: {e}")
        return False


async def set_email_cooldown(user_id: str):
    try:
        await redis_client.set(
            f"email_cooldown:{user_id}",
            "1",
            ex=60
        )
    except Exception as e:
        logger.warning(f"Failed to set email cooldown: {e}")

async def email_cooldown_active(user_id: str):
    try:
        return bool(
            await redis_client.exists(
                f"email_cooldown:{user_id}"
            )
        )
    except Exception as e:
        logger.warning(f"Failed to check email cooldown: {e}")
        return False
 

async def rate_limit_auth(request: Request):
    """
    Limits authentication endpoints to 10 requests per 60 seconds per IP address.
    Uses atomic Redis INCR to prevent race conditions with concurrent requests.
    Gracefully degrades if Redis is temporarily unreachable.
    """
    try:
        ip = getattr(request.client, 'host', None) or "server"
        key = f"rate_limit:auth:{ip}"
        limit = 10
        window = 60
        
        current = await redis_client.incr(key)
        
        if current == 1:
            await redis_client.expire(key, window)
        
        if current > limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests. Please try again later."
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning(f"Rate limit Redis check bypassed: {exc}")
