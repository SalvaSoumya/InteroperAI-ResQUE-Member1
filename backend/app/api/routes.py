from fastapi import APIRouter


router = APIRouter()


@router.get("/status")
def api_status():
    return {
        "service": "InteroperAI-ResQ",
        "status": "online",
        "message": "Disaster data integration API is ready",
    }