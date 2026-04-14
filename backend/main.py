"""
FastAPI Backend for Report Maker
"""
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
import pandas as pd
import numpy as np
import io
import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).with_name(".env"))

# Initialize database on startup
from database.connection import init_db
from routes.db_routes import router as db_router
from routes.upload_summary import router as upload_summary_router
from routes.ingestion import router as ingestion_router
from routes.ai_insights_routes import router as ai_insights_router

app = FastAPI(
    title="Report Maker API",
    description="Backend API for data analysis and ML models",
    version="1.0.0"
)

# Initialize database tables
@app.on_event("startup")
async def startup_event():
    init_db()
    print("Database initialized!")

# Include database routes
app.include_router(db_router)
app.include_router(upload_summary_router)
app.include_router(ingestion_router)
app.include_router(ai_insights_router)

# Parse CORS origins from environment variable if provided.
def get_cors_origins() -> List[str]:
    raw_origins = os.getenv("CORS_ORIGINS", "")
    if raw_origins.strip():
        origins = [origin.strip() for origin in raw_origins.split(",") if origin.strip()]
        if origins:
            return origins
    return [
        "http://localhost:5175",
        "http://localhost:5174",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]


def get_cors_origin_regex() -> Optional[str]:
    """
    Allow local private-network dev origins (LAN testing), unless overridden by env.
    """
    env_regex = os.getenv("CORS_ORIGIN_REGEX", "").strip()
    if env_regex:
        return env_regex
    return r"^https?://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$"

# CORS - Allow React frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_origin_regex=get_cors_origin_regex(),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store uploaded data in memory (for demo - use database in production)
data_store: Dict[str, pd.DataFrame] = {}


# ============== MODELS ==============

class PredictionRequest(BaseModel):
    data: List[Dict[str, Any]]
    target_column: str
    feature_columns: List[str]
    model_type: str = "linear"  # linear, ridge, lasso, elasticnet, bayesian, constrained_ridge
    standardization: str = "none"  # none, standardize, minmax, robust, log, sqrt
    non_positive_features: Optional[List[str]] = None  # Features with coef <= 0
    non_negative_features: Optional[List[str]] = None  # Features with coef >= 0
    remove_outliers: bool = False  # Remove outliers using IQR method


class PredictionResponse(BaseModel):
    predictions: List[float]
    actuals: Optional[List[float]] = None
    outlier_indices: Optional[List[int]] = None
    metrics: Dict[str, float]
    coefficients: Optional[Dict[str, float]] = None
    coefficients_transformed: Optional[Dict[str, float]] = None
    elasticities: Optional[Dict[str, float]] = None
    betas: Optional[Dict[str, float]] = None
    contributions: Optional[Dict[str, float]] = None
    standardization_used: Optional[str] = None
    model_type: Optional[str] = None


class CorrelationRequest(BaseModel):
    data: List[Dict[str, Any]]
    columns: List[str]


class AdstockSettings(BaseModel):
    enabled: bool = False
    columns: List[str] = []
    decay: float = 0.5  # Default decay rate
    auto: bool = False  # Auto-select best decay
    candidate_decays: Optional[List[float]] = None  # [0.2, 0.4, 0.6, 0.8]


class LogisticSettings(BaseModel):
    enabled: bool = False
    columns: List[str] = []
    steepness: float = 1.0  # k parameter
    midpoint: float = 0.0  # midpoint shift
    auto: bool = False  # Auto-select best k
    candidate_k: Optional[List[float]] = None  # [0.5, 1.0, 2.0, 3.0]
    candidate_midpoints: Optional[List[float]] = None
    steepness_map: Optional[Dict[str, float]] = None  # Per-column overrides
    midpoint_map: Optional[Dict[str, float]] = None


class KalmanRequest(BaseModel):
    data: List[Dict[str, Any]]
    target_column: str
    feature_columns: List[str]
    q: float = 1e-4  # Process noise
    r: float = 1.0  # Measurement noise
    adaptive: bool = True  # Adaptive Q and R
    standardize: bool = True
    non_positive_features: Optional[List[str]] = None
    non_negative_features: Optional[List[str]] = None
    # Transformation settings
    adstock_settings: Optional[AdstockSettings] = None
    logistic_settings: Optional[LogisticSettings] = None


class KalmanResponse(BaseModel):
    predictions: List[float]
    actuals: List[float]
    metrics: Dict[str, float]
    coefficients: Dict[str, float]  # Final coefficients (original scale)
    coefficients_instantaneous: Optional[Dict[str, float]] = None  # Before long-run adjustment
    tv_coefficients: Dict[str, List[float]]
    elasticities: Dict[str, float]
    contributions: Dict[str, float]
    q_history: List[float]
    r_history: List[float]
    # Transformation metadata
    adstock_decays: Optional[Dict[str, float]] = None  # Chosen decay per column
    logistic_metadata: Optional[Dict[str, Dict[str, Any]]] = None  # S-curve params per column


# ============== ROUTES ==============

@app.get("/")
async def root():
    return {"message": "Report Maker API is running", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload CSV file and store in memory"""
    try:
        contents = await file.read()
        df = pd.read_csv(io.StringIO(contents.decode('utf-8')))
        
        # Store with filename as key
        data_store[file.filename] = df
        
        return {
            "filename": file.filename,
            "rows": len(df),
            "columns": list(df.columns),
            "dtypes": {col: str(dtype) for col, dtype in df.dtypes.items()}
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/analyze/correlation")
async def analyze_correlation(request: CorrelationRequest):
    """Calculate correlation matrix"""
    try:
        df = pd.DataFrame(request.data)
        cols = request.columns if request.columns else df.select_dtypes(include=[np.number]).columns.tolist()
        
        corr_matrix = df[cols].corr().to_dict()
        
        return {"correlation_matrix": corr_matrix}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/predict")
async def predict(request: PredictionRequest):
    """Run prediction model"""
    try:
        df = pd.DataFrame(request.data)
        
        # Convert columns to numeric, coercing errors to NaN
        for col in request.feature_columns + [request.target_column]:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        
        # Drop rows with NaN values in the columns we need
        df = df.dropna(subset=request.feature_columns + [request.target_column])
        
        if len(df) == 0:
            raise ValueError("No valid numeric data after cleaning. Check your column selections.")
        
        X = df[request.feature_columns]
        y = df[request.target_column]
        
        # Import here to avoid loading if not needed
        from models.regression import run_regression
        
        result = run_regression(
            X, y, 
            model_type=request.model_type, 
            standardization=request.standardization,
            non_positive_features=request.non_positive_features,
            non_negative_features=request.non_negative_features,
            remove_outliers=request.remove_outliers
        )
        
        return PredictionResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/kalman")
async def kalman_filter(request: KalmanRequest):
    """Run Time-Varying Kalman Filter regression with optional adstock and logistic transforms"""
    try:
        df = pd.DataFrame(request.data)
        
        # Convert columns to numeric
        for col in request.feature_columns + [request.target_column]:
            df[col] = pd.to_numeric(df[col], errors='coerce')
        
        df = df.dropna(subset=request.feature_columns + [request.target_column])
        
        if len(df) == 0:
            raise ValueError("No valid numeric data after cleaning.")
        
        # Apply transformations
        from models.transforms import apply_geometric_adstock, apply_logistic_transform
        
        adstock_decays = {}
        logistic_metadata = {}
        target_values = df[request.target_column].values
        
        # Apply adstock transformation
        if request.adstock_settings and request.adstock_settings.enabled:
            df, adstock_decays = apply_geometric_adstock(
                df,
                columns=request.adstock_settings.columns,
                decay=request.adstock_settings.decay,
                auto=request.adstock_settings.auto,
                candidate_decays=request.adstock_settings.candidate_decays,
                target_values=target_values
            )
        
        # Apply logistic S-curve transformation
        if request.logistic_settings and request.logistic_settings.enabled:
            df, logistic_metadata = apply_logistic_transform(
                df,
                columns=request.logistic_settings.columns,
                steepness=request.logistic_settings.steepness,
                midpoint=request.logistic_settings.midpoint,
                auto=request.logistic_settings.auto,
                candidate_k=request.logistic_settings.candidate_k,
                candidate_midpoints=request.logistic_settings.candidate_midpoints,
                steepness_map=request.logistic_settings.steepness_map,
                midpoint_map=request.logistic_settings.midpoint_map,
                target_values=target_values
            )
        
        X = df[request.feature_columns]
        y = df[request.target_column]
        
        from models.kalman import run_kalman_filter
        
        result = run_kalman_filter(
            X, y,
            q=request.q,
            r=request.r,
            adaptive=request.adaptive,
            standardize=request.standardize,
            non_positive_features=request.non_positive_features,
            non_negative_features=request.non_negative_features,
            adstock_map=adstock_decays,
            scurve_map=logistic_metadata
        )
        
        # Add transformation metadata to response
        result["adstock_decays"] = adstock_decays if adstock_decays else None
        result["logistic_metadata"] = logistic_metadata if logistic_metadata else None
        
        return KalmanResponse(**result)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============== RUN ==============

if __name__ == "__main__":
    import uvicorn
    print("Starting FastAPI server on localhost:8002")
    uvicorn.run(app, host="127.0.0.1", port=8002, log_level="info")
