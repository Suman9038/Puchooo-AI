import redis.asyncio as redis
from app.core.config import settings


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