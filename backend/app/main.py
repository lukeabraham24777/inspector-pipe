"""FastAPI application entry point for ILI Pipeline Alignment System."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router

app = FastAPI(
    title="ILI Pipeline Alignment System",
    description="Automated ILI data alignment across multi-year inspection runs",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)


@app.get("/")
async def root():
    return {"status": "ok", "service": "ILI Pipeline Alignment System"}
