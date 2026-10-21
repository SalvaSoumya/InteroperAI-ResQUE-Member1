from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.api.upload_routes import router as upload_router
from app.api.job_routes import router as job_router
from app.api.integration_routes import router as integration_router
app = FastAPI(
    title="InteroperAI-ResQ API",
    description="Disaster Data Integration and Emergency Response Coordination API",
    version="1.0.0",
)


# Allow the React frontend to communicate with FastAPI
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Register API routers
app.include_router(router, prefix="/api/v1")
app.include_router(upload_router, prefix="/api/v1")
app.include_router(integration_router, prefix="/api/v1")
app.include_router(job_router, prefix="/api/v1")


# Root endpoint
@app.get("/")
def root():
    return {
        "message": "InteroperAI-ResQ API is running",
        "status": "online",
    }


# Health check
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": "InteroperAI-ResQ Backend",
    }