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
    """
    ip = request.client.host if request.client else "unknown"
    key = f"rate_limit:auth:{ip}"
    limit = 10
    window = 60
    
    current = await redis_client.get(key)
    if current and int(current) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please try again later."
        )
    
    pipe = redis_client.pipeline()
    pipe.incr(key)
    if not current:
        pipe.expire(key, window)
    await pipe.execute()