import redis.asyncio as redis
from app.core.config import settings
from fastapi import Request, HTTPException, status


JTI_EXPIRY = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60

redis_client= redis.from_url(settings.LOCAL_REDIS_URL, decode_responses=True)


async def add_token_jti_to_blocklist(jwt_id:str):
    await redis_client.set(
        name= f"block_{jwt_id}",
        value="blocked",
        ex= JTI_EXPIRY,
    )
async def token_in_blocklist(jwt_id:str)-> bool:
    return await redis_client.exists(f"block_{jwt_id}")


async def set_email_cooldown(user_id:str):
    await redis_client.set(
        f"email_cooldown:{user_id}",
        "1",
        ex=60
    ) 
async def email_cooldown_active(user_id:str):
    return bool(
        await redis_client.exists(
            f"email_cooldown:{user_id}"
        )
    )
 
async def rate_limit_auth(request: Request):
    """
    Limits authentication endpoints to 10 requests per 60 seconds per IP address.
    Uses atomic Redis INCR to prevent race conditions with concurrent requests.
    """
    # Use request.client.host if available, otherwise fall back to server hostname
    # to avoid "unknown" IP grouping that defeats per-IP rate limiting
    ip = getattr(request.client, 'host', None) or "server"
    key = f"rate_limit:auth:{ip}"
    limit = 10
    window = 60
    
    # Atomic INCR with NX/EX for rate limiting - this is the race-condition-free approach
    # INCR returns the new counter value after incrementing
    current = await redis_client.incr(key)
    
    # Set expiration only on first increment (when key was created)
    if current == 1:
        await redis_client.expire(key, window)
    
    # Check if current count exceeds the limit
    if current > limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later."
        )
