from fastapi import FastAPI
from contextlib import asynccontextmanager
from app.auth.auth_routes import router as auth_router
from app.routes.rag_routes import router as rag_router
from app.routes.video_routes import router as video_router
from app.routes.admin_routes import router as admin_router
from app.middleware import setup_middlewares
from app.core.exceptions import register_exception_handlers
from app.core.database import engine
from app.rag_pipeline.vector_store import QdrantService
from app.core.logger import logger



@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Puchooo AI...")
    qdrant = QdrantService()
    qdrant.create_collection()
    yield           
    logger.info("Shutting down Puchooo AI...")                   
    await engine.dispose() 

app = FastAPI(
    title="Puchooo AI API",
    description="Backend for YouTube RAG Chatbot",
    lifespan=lifespan
)

# Register Middlewares
setup_middlewares(app)

# Register Exception Handlers
register_exception_handlers(app)

# Registering Routers
app.include_router(auth_router)
app.include_router(rag_router)
app.include_router(video_router)
app.include_router(admin_router)

@app.get("/")
def root():
    return{
        "message":"Backend is working fine"
    }