"""
Database API Routes
REST endpoints for users, datasets, variables, models, and results
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
from datetime import datetime

from database.connection import get_db
from database import crud

router = APIRouter(prefix="/api/db", tags=["database"])


# ============== PYDANTIC SCHEMAS ==============
class UserCreate(BaseModel):
    username: str
    password: str
    email: Optional[str] = None


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: Optional[str]
    created_at: datetime
    last_login: Optional[datetime]
    
    class Config:
        from_attributes = True


class DatasetCreate(BaseModel):
    name: str
    description: Optional[str] = None
    filename: Optional[str] = None
    row_count: Optional[int] = None
    project_id: Optional[int] = None
    file_data: Optional[str] = None  # CSV data as string
    column_count: Optional[int] = None
    columns_meta: Optional[List[Dict]] = None  # [{name, type}, ...]


class DatasetResponse(BaseModel):
    id: int
    user_id: int
    project_id: Optional[int]
    name: str
    description: Optional[str]
    filename: Optional[str]
    row_count: Optional[int]
    column_count: Optional[int]
    columns_meta: Optional[List[Dict]]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class DatasetWithData(BaseModel):
    id: int
    user_id: int
    project_id: Optional[int]
    name: str
    description: Optional[str]
    filename: Optional[str]
    file_data: Optional[str]
    row_count: Optional[int]
    column_count: Optional[int]
    columns_meta: Optional[List[Dict]]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class VariableCreate(BaseModel):
    name: str
    display_name: Optional[str] = None
    dtype: str = "numeric"
    role: str = "feature"
    mean: Optional[float] = None
    std: Optional[float] = None
    min_val: Optional[float] = None
    max_val: Optional[float] = None
    null_count: Optional[int] = None
    unique_count: Optional[int] = None


class VariableUpdate(BaseModel):
    display_name: Optional[str] = None
    role: Optional[str] = None
    transform_type: Optional[str] = None
    transform_params: Optional[Dict] = None
    constraint: Optional[str] = None


class VariableResponse(BaseModel):
    id: int
    dataset_id: int
    name: str
    display_name: Optional[str]
    dtype: Optional[str]
    role: str
    mean: Optional[float]
    std: Optional[float]
    min_val: Optional[float]
    max_val: Optional[float]
    null_count: Optional[int]
    unique_count: Optional[int]
    transform_type: Optional[str]
    transform_params: Optional[Dict]
    constraint: Optional[str]
    
    class Config:
        from_attributes = True


class ModelCreate(BaseModel):
    dataset_id: int
    name: str
    model_type: str
    target_variable: str
    feature_variables: List[str]
    hyperparameters: Optional[Dict] = None
    transform_config: Optional[Dict] = None
    constraint_config: Optional[Dict] = None
    description: Optional[str] = None


class ModelResponse(BaseModel):
    id: int
    user_id: int
    dataset_id: int
    name: str
    description: Optional[str]
    model_type: str
    target_variable: str
    feature_variables: List[str]
    hyperparameters: Optional[Dict]
    transform_config: Optional[Dict]
    constraint_config: Optional[Dict]
    status: str
    error_message: Optional[str]
    created_at: datetime
    trained_at: Optional[datetime]
    
    class Config:
        from_attributes = True


class ModelResultResponse(BaseModel):
    id: int
    model_id: int
    r2: Optional[float]
    adj_r2: Optional[float]
    mape: Optional[float]
    mae: Optional[float]
    rmse: Optional[float]
    coefficients: Optional[Dict]
    elasticities: Optional[Dict]
    contributions: Optional[Dict]
    created_at: datetime
    
    class Config:
        from_attributes = True


# ============== USER ROUTES ==============
@router.post("/users/register", response_model=UserResponse)
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    """Register a new user"""
    existing = crud.get_user_by_username(db, user.username)
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    return crud.create_user(db, user.username, user.password, user.email)


@router.post("/users/login", response_model=UserResponse)
def login_user(credentials: UserLogin, db: Session = Depends(get_db)):
    """Login user"""
    user = crud.authenticate_user(db, credentials.username, credentials.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return user


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db)):
    """Get user by ID"""
    user = crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ============== PROJECT ROUTES ==============
class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    color: str = "#10b981"
    icon: str = "folder"


class ProjectResponse(BaseModel):
    id: int
    user_id: int
    name: str
    description: Optional[str]
    color: str
    icon: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ProjectSummary(BaseModel):
    id: int
    name: str
    description: Optional[str]
    color: str
    icon: str
    created_at: datetime
    updated_at: datetime
    dataset_count: int
    model_count: int


@router.post("/projects/{user_id}", response_model=ProjectResponse)
def create_project(user_id: int, project: ProjectCreate, db: Session = Depends(get_db)):
    """Create a new project for user"""
    user = crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return crud.create_project(db, user_id, project.name, project.description, project.color, project.icon)


@router.get("/projects/user/{user_id}", response_model=List[ProjectSummary])
def get_user_projects(user_id: int, db: Session = Depends(get_db)):
    """Get all projects for a user with summary"""
    projects = crud.get_projects_by_user(db, user_id)
    return [crud.get_project_summary(db, p.id) for p in projects]


@router.get("/projects/{project_id}", response_model=ProjectSummary)
def get_project(project_id: int, db: Session = Depends(get_db)):
    """Get project by ID with summary"""
    summary = crud.get_project_summary(db, project_id)
    if not summary:
        raise HTTPException(status_code=404, detail="Project not found")
    return summary


@router.patch("/projects/{project_id}", response_model=ProjectResponse)
def update_project(project_id: int, updates: ProjectCreate, db: Session = Depends(get_db)):
    """Update project"""
    project = crud.update_project(
        db, project_id,
        name=updates.name,
        description=updates.description,
        color=updates.color,
        icon=updates.icon
    )
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.delete("/projects/{project_id}")
def delete_project(project_id: int, db: Session = Depends(get_db)):
    """Delete project (soft delete)"""
    if not crud.delete_project(db, project_id):
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "Project deleted"}


# ============== DATASET ROUTES ==============
@router.post("/datasets/{user_id}", response_model=DatasetResponse)
def create_dataset(user_id: int, dataset: DatasetCreate, db: Session = Depends(get_db)):
    """Create a new dataset for user"""
    user = crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return crud.create_dataset(
        db, user_id, dataset.name, dataset.filename, 
        None, dataset.row_count, dataset.description,
        project_id=dataset.project_id,
        file_data=dataset.file_data,
        column_count=dataset.column_count,
        columns_meta=dataset.columns_meta
    )


@router.get("/datasets/user/{user_id}", response_model=List[DatasetResponse])
def get_user_datasets(user_id: int, db: Session = Depends(get_db)):
    """Get all datasets for a user"""
    return crud.get_datasets_by_user(db, user_id)


@router.get("/datasets/project/{project_id}", response_model=List[DatasetResponse])
def get_project_datasets(project_id: int, db: Session = Depends(get_db)):
    """Get all datasets for a project"""
    return crud.get_datasets_by_project(db, project_id)


@router.get("/datasets/{dataset_id}/full", response_model=DatasetWithData)
def get_dataset_with_data(dataset_id: int, db: Session = Depends(get_db)):
    """Get dataset by ID including file data"""
    dataset = crud.get_dataset_by_id(db, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset


@router.get("/datasets/{dataset_id}", response_model=DatasetResponse)
def get_dataset(dataset_id: int, db: Session = Depends(get_db)):
    """Get dataset by ID"""
    dataset = crud.get_dataset_by_id(db, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return dataset


@router.delete("/datasets/{dataset_id}")
def delete_dataset(dataset_id: int, db: Session = Depends(get_db)):
    """Delete dataset"""
    if not crud.delete_dataset(db, dataset_id):
        raise HTTPException(status_code=404, detail="Dataset not found")
    return {"message": "Dataset deleted"}


# ============== VARIABLE ROUTES ==============
@router.post("/variables/{dataset_id}", response_model=VariableResponse)
def create_variable(dataset_id: int, variable: VariableCreate, db: Session = Depends(get_db)):
    """Create a variable for dataset"""
    dataset = crud.get_dataset_by_id(db, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return crud.create_variable(
        db, dataset_id, variable.name, variable.dtype, variable.role,
        mean=variable.mean, std=variable.std, min_val=variable.min_val,
        max_val=variable.max_val, null_count=variable.null_count,
        unique_count=variable.unique_count
    )


@router.post("/variables/{dataset_id}/bulk", response_model=List[VariableResponse])
def create_variables_bulk(dataset_id: int, variables: List[VariableCreate], db: Session = Depends(get_db)):
    """Create multiple variables at once"""
    dataset = crud.get_dataset_by_id(db, dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    variables_data = [v.model_dump() for v in variables]
    return crud.create_variables_bulk(db, dataset_id, variables_data)


@router.get("/variables/dataset/{dataset_id}", response_model=List[VariableResponse])
def get_dataset_variables(dataset_id: int, db: Session = Depends(get_db)):
    """Get all variables for a dataset"""
    return crud.get_variables_by_dataset(db, dataset_id)


@router.patch("/variables/{variable_id}", response_model=VariableResponse)
def update_variable(variable_id: int, update: VariableUpdate, db: Session = Depends(get_db)):
    """Update variable settings"""
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    variable = crud.update_variable(db, variable_id, **update_data)
    if not variable:
        raise HTTPException(status_code=404, detail="Variable not found")
    return variable


# ============== MODEL ROUTES ==============
@router.post("/models/{user_id}", response_model=ModelResponse)
def create_model(user_id: int, model: ModelCreate, db: Session = Depends(get_db)):
    """Create a new model"""
    user = crud.get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    dataset = crud.get_dataset_by_id(db, model.dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    return crud.create_model(
        db, user_id, model.dataset_id, model.name, model.model_type,
        model.target_variable, model.feature_variables,
        model.hyperparameters, model.transform_config,
        model.constraint_config, model.description
    )


@router.get("/models/user/{user_id}", response_model=List[ModelResponse])
def get_user_models(user_id: int, db: Session = Depends(get_db)):
    """Get all models for a user"""
    return crud.get_models_by_user(db, user_id)


@router.get("/models/dataset/{dataset_id}", response_model=List[ModelResponse])
def get_dataset_models(dataset_id: int, db: Session = Depends(get_db)):
    """Get all models for a dataset"""
    return crud.get_models_by_dataset(db, dataset_id)


@router.get("/models/project/{project_id}")
def get_project_models(project_id: int, db: Session = Depends(get_db)):
    """Get all models for a project with latest result_id"""
    models = crud.get_models_by_project(db, project_id)
    result = []
    for model in models:
        latest_result = crud.get_latest_result(db, model.id)
        result.append({
            "id": model.id,
            "name": model.name,
            "model_type": model.model_type,
            "target_variable": model.target_variable,
            "feature_variables": model.feature_variables,
            "status": model.status,
            "created_at": model.created_at,
            "trained_at": model.trained_at,
            "result_id": latest_result.id if latest_result else None,
        })
    return result


@router.get("/models/{model_id}", response_model=ModelResponse)
def get_model(model_id: int, db: Session = Depends(get_db)):
    """Get model by ID"""
    model = crud.get_model_by_id(db, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return model


@router.patch("/models/{model_id}/status")
def update_model_status(model_id: int, status: str, error: str = None, db: Session = Depends(get_db)):
    """Update model status"""
    model = crud.update_model_status(db, model_id, status, error)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    return {"message": "Status updated", "status": status}


@router.delete("/models/{model_id}")
def delete_model(model_id: int, db: Session = Depends(get_db)):
    """Delete model"""
    if not crud.delete_model(db, model_id):
        raise HTTPException(status_code=404, detail="Model not found")
    return {"message": "Model deleted"}


# ============== MODEL RESULT ROUTES ==============
@router.get("/results/model/{model_id}", response_model=List[ModelResultResponse])
def get_model_results(model_id: int, db: Session = Depends(get_db)):
    """Get all results for a model"""
    return crud.get_results_by_model(db, model_id)


@router.get("/results/model/{model_id}/latest", response_model=ModelResultResponse)
def get_latest_model_result(model_id: int, db: Session = Depends(get_db)):
    """Get latest result for a model"""
    result = crud.get_latest_result(db, model_id)
    if not result:
        raise HTTPException(status_code=404, detail="No results found")
    return result


@router.get("/results/{result_id}/full")
def get_full_result(result_id: int, db: Session = Depends(get_db)):
    """Get full result including predictions and TV coefficients"""
    from database.models import ModelResult
    result = db.query(ModelResult).filter(ModelResult.id == result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    
    return {
        "id": result.id,
        "model_id": result.model_id,
        "metrics": {
            "r2": result.r2,
            "adj_r2": result.adj_r2,
            "mape": result.mape,
            "mae": result.mae,
            "rmse": result.rmse,
            "aic": result.aic,
            "bic": result.bic
        },
        "coefficients": result.coefficients,
        "coefficients_instantaneous": result.coefficients_instantaneous,
        "std_errors": result.std_errors,
        "p_values": result.p_values,
        "t_stats": result.t_stats,
        "elasticities": result.elasticities,
        "contributions": result.contributions,
        "vif": result.vif,
        "tv_coefficients": result.tv_coefficients,
        "q_history": result.q_history,
        "r_history": result.r_history,
        "adstock_decays": result.adstock_decays,
        "logistic_metadata": result.logistic_metadata,
        "predictions": result.predictions,
        "actuals": result.actuals,
        "residuals": result.residuals,
        "created_at": result.created_at
    }


# ============== SAVE MODEL RESULT ==============
class ModelResultCreate(BaseModel):
    metrics: Dict[str, Any]
    coefficients: Dict[str, float]
    coefficients_instantaneous: Optional[Dict[str, float]] = None
    std_errors: Optional[Dict[str, float]] = None
    p_values: Optional[Dict[str, float]] = None
    elasticities: Optional[Dict[str, float]] = None
    contributions: Optional[Dict[str, float]] = None
    tv_coefficients: Optional[Dict[str, List[float]]] = None
    predictions: Optional[List[float]] = None
    actuals: Optional[List[float]] = None
    q_history: Optional[List[float]] = None
    r_history: Optional[List[float]] = None
    adstock_decays: Optional[Dict[str, float]] = None
    logistic_metadata: Optional[Dict[str, Any]] = None


@router.post("/results/{model_id}", response_model=Dict[str, Any])
def save_model_result(model_id: int, result: ModelResultCreate, db: Session = Depends(get_db)):
    """Save model result after training"""
    model = crud.get_model_by_id(db, model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Model not found")
    
    db_result = crud.create_model_result(
        db,
        model_id=model_id,
        metrics=result.metrics,
        coefficients=result.coefficients,
        predictions=result.predictions,
        actuals=result.actuals,
        coefficients_instantaneous=result.coefficients_instantaneous,
        std_errors=result.std_errors,
        p_values=result.p_values,
        elasticities=result.elasticities,
        contributions=result.contributions,
        tv_coefficients=result.tv_coefficients,
        q_history=result.q_history,
        r_history=result.r_history,
    )
    
    # Update model status
    crud.update_model_status(db, model_id, "completed")
    
    return {"id": db_result.id, "created_at": str(db_result.created_at)}


# ============== QUICK SAVE (Create model + result in one call) ==============
class QuickSaveRequest(BaseModel):
    user_id: int
    project_id: Optional[int] = None  # Project to save to
    dataset_name: str
    model_name: str
    model_type: str  # kalman, ols, ridge, etc.
    target_variable: str
    feature_variables: List[str]
    hyperparameters: Optional[Dict[str, Any]] = None
    transform_config: Optional[Dict[str, Any]] = None
    constraint_config: Optional[Dict[str, Any]] = None
    # Results
    metrics: Dict[str, Any]
    coefficients: Dict[str, float]
    coefficients_instantaneous: Optional[Dict[str, float]] = None
    elasticities: Optional[Dict[str, float]] = None
    contributions: Optional[Dict[str, float]] = None
    tv_coefficients: Optional[Dict[str, List[float]]] = None
    predictions: Optional[List[float]] = None
    actuals: Optional[List[float]] = None
    q_history: Optional[List[float]] = None
    r_history: Optional[List[float]] = None
    adstock_decays: Optional[Dict[str, float]] = None
    logistic_metadata: Optional[Dict[str, Any]] = None


@router.post("/quick-save")
def quick_save_model(request: QuickSaveRequest, db: Session = Depends(get_db)):
    """Create dataset, model, and result in one call - for easy saving"""
    # Check user exists
    user = crud.get_user_by_id(db, request.user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Create or get dataset (with project_id)
    dataset = crud.create_dataset(
        db,
        user_id=request.user_id,
        name=request.dataset_name,
        row_count=len(request.predictions) if request.predictions else 0,
        project_id=request.project_id
    )
    
    # Create model (with project_id)
    model = crud.create_model(
        db,
        user_id=request.user_id,
        dataset_id=dataset.id,
        name=request.model_name,
        model_type=request.model_type,
        target_variable=request.target_variable,
        feature_variables=request.feature_variables,
        hyperparameters=request.hyperparameters,
        transform_config=request.transform_config,
        constraint_config=request.constraint_config,
        project_id=request.project_id,
    )
    
    # Create result
    result = crud.create_model_result(
        db,
        model_id=model.id,
        metrics=request.metrics,
        coefficients=request.coefficients,
        predictions=request.predictions,
        actuals=request.actuals,
        coefficients_instantaneous=request.coefficients_instantaneous,
        elasticities=request.elasticities,
        contributions=request.contributions,
        tv_coefficients=request.tv_coefficients,
        q_history=request.q_history,
        r_history=request.r_history,
        adstock_decays=request.adstock_decays,
        logistic_metadata=request.logistic_metadata,
    )
    
    # Update model status
    crud.update_model_status(db, model.id, "completed")
    
    return {
        "dataset_id": dataset.id,
        "model_id": model.id,
        "result_id": result.id,
        "message": "Model saved successfully"
    }


@router.get("/user/{user_id}/saved-models")
def get_user_saved_models(user_id: int, db: Session = Depends(get_db)):
    """Get all saved models with their latest results for a user"""
    models = crud.get_models_by_user(db, user_id)
    
    result = []
    for model in models:
        latest_result = crud.get_latest_result(db, model.id)
        result.append({
            "id": model.id,
            "name": model.name,
            "model_type": model.model_type,
            "target_variable": model.target_variable,
            "feature_variables": model.feature_variables,
            "status": model.status,
            "created_at": model.created_at,
            "trained_at": model.trained_at,
            "metrics": {
                "r2": latest_result.r2 if latest_result else None,
                "mape": latest_result.mape if latest_result else None,
            } if latest_result else None,
            "result_id": latest_result.id if latest_result else None,
        })
    
    return result
