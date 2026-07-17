from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
import time
from app.core.logger import logger

class RequestTimeLoggerMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log the execution time of each request.
    """
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Process the request
        response = await call_next(request)
        
        process_time = time.time() - start_time
        
        # Log the request details and processing time
        logger.info(
            f"Method: {request.method} | "
            f"Path: {request.url.path} | "
            f"Status: {response.status_code} | "
            f"Time: {process_time:.4f} secs"
        )
        
        # Add custom header to response for frontend tracking (optional)
        response.headers["X-Process-Time"] = str(process_time)
        return response

def setup_middlewares(app: FastAPI):
    """
    Registers all middlewares to the FastAPI application.
    """
    
    # 1. Custom Request Logging Middleware
    app.add_middleware(RequestTimeLoggerMiddleware)
    
    # 2. CORS Middleware (Crucial for Frontend)
    # Adding typical React/Next.js/Vite development ports
    origins = [
        "*",
        "http://localhost",
        "http://localhost:3000",   # React / Next.js
        "http://localhost:5173",   # Vite
        "http://localhost:8080",
    ]

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,       # Allow cookies & authorization headers
        allow_methods=["*"],          # Allow all methods (GET, POST, PUT, DELETE, OPTIONS)
        allow_headers=["*"],          # Allow all headers
    )
    
    logger.info("Middlewares configured successfully.")
