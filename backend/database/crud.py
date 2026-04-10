"""
CRUD Operations for Database
Create, Read, Update, Delete operations for all models
"""
from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import desc
import hashlib
import json

from .models import User, Project, Dataset, Variable, Model, ModelResult


# ============== PASSWORD HASHING ==============
def hash_password(password: str) -> str:
    """Simple password hashing (use bcrypt in production)"""
    return hashlib.sha256(password.encode()).hexdigest()


def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    return hash_password(password) == hashed


# ============== USER CRUD ==============
def create_user(db: Session, username: str, password: str, email: str = None) -> User:
    """Create a new user"""
    user = User(
        username=username,
        password_hash=hash_password(password),
        email=email
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_user_by_username(db: Session, username: str) -> Optional[User]:
    """Get user by username"""
    return db.query(User).filter(User.username == username).first()


def get_user_by_id(db: Session, user_id: int) -> Optional[User]:
    """Get user by ID"""
    return db.query(User).filter(User.id == user_id).first()


def authenticate_user(db: Session, username: str, password: str) -> Optional[User]:
    """Authenticate user and update last login"""
    user = get_user_by_username(db, username)
    if user and verify_password(password, user.password_hash):
        user.last_login = datetime.utcnow()
        db.commit()
        return user
    return None


def get_all_users(db: Session) -> List[User]:
    """Get all users"""
    return db.query(User).all()


# ============== PROJECT CRUD ==============
def create_project(
    db: Session,
    user_id: int,
    name: str,
    description: str = None,
    color: str = "#10b981",
    icon: str = "folder"
) -> Project:
    """Create a new project"""
    project = Project(
        user_id=user_id,
        name=name,
        description=description,
        color=color,
        icon=icon
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


def get_project_by_id(db: Session, project_id: int) -> Optional[Project]:
    """Get project by ID"""
    return db.query(Project).filter(Project.id == project_id).first()


def get_projects_by_user(db: Session, user_id: int) -> List[Project]:
    """Get all projects for a user"""
    return db.query(Project).filter(
        Project.user_id == user_id,
        Project.is_active == True
    ).order_by(desc(Project.updated_at)).all()


def update_project(db: Session, project_id: int, **kwargs) -> Optional[Project]:
    """Update project fields"""
    project = get_project_by_id(db, project_id)
    if project:
        for key, value in kwargs.items():
            if hasattr(project, key):
                setattr(project, key, value)
        project.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(project)
    return project


def delete_project(db: Session, project_id: int) -> bool:
    """Soft delete project (set is_active=False)"""
    project = get_project_by_id(db, project_id)
    if project:
        project.is_active = False
        db.commit()
        return True
    return False


def get_project_summary(db: Session, project_id: int) -> Dict:
    """Get project with counts of datasets and models"""
    project = get_project_by_id(db, project_id)
    if not project:
        return None
    
    dataset_count = db.query(Dataset).filter(Dataset.project_id == project_id).count()
    model_count = db.query(Model).filter(Model.project_id == project_id).count()
    
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "color": project.color,
        "icon": project.icon,
        "created_at": project.created_at,
        "updated_at": project.updated_at,
        "dataset_count": dataset_count,
        "model_count": model_count,
    }


# ============== DATASET CRUD ==============
def create_dataset(
    db: Session,
    user_id: int,
    name: str,
    filename: str = None,
    file_path: str = None,
    row_count: int = None,
    description: str = None,
    project_id: int = None,
    file_data: str = None,
    column_count: int = None,
    columns_meta: Dict = None
) -> Dataset:
    """Create a new dataset"""
    dataset = Dataset(
        user_id=user_id,
        project_id=project_id,
        name=name,
        filename=filename,
        file_path=file_path,
        file_data=file_data,
        row_count=row_count,
        column_count=column_count,
        columns_meta=columns_meta,
        description=description
    )
    db.add(dataset)
    db.commit()
    db.refresh(dataset)
    return dataset


def get_datasets_by_project(db: Session, project_id: int) -> List[Dataset]:
    """Get all datasets for a project"""
    return db.query(Dataset).filter(Dataset.project_id == project_id).order_by(desc(Dataset.created_at)).all()


def get_dataset_by_id(db: Session, dataset_id: int) -> Optional[Dataset]:
    """Get dataset by ID"""
    return db.query(Dataset).filter(Dataset.id == dataset_id).first()


def get_datasets_by_user(db: Session, user_id: int) -> List[Dataset]:
    """Get all datasets for a user"""
    return db.query(Dataset).filter(Dataset.user_id == user_id).order_by(desc(Dataset.created_at)).all()


def update_dataset(db: Session, dataset_id: int, **kwargs) -> Optional[Dataset]:
    """Update dataset fields"""
    dataset = get_dataset_by_id(db, dataset_id)
    if dataset:
        for key, value in kwargs.items():
            if hasattr(dataset, key):
                setattr(dataset, key, value)
        dataset.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(dataset)
    return dataset


def delete_dataset(db: Session, dataset_id: int) -> bool:
    """Delete dataset and all related data"""
    dataset = get_dataset_by_id(db, dataset_id)
    if dataset:
        db.delete(dataset)
        db.commit()
        return True
    return False


# ============== VARIABLE CRUD ==============
def create_variable(
    db: Session,
    dataset_id: int,
    name: str,
    dtype: str = "numeric",
    role: str = "feature",
    **stats
) -> Variable:
    """Create a new variable"""
    variable = Variable(
        dataset_id=dataset_id,
        name=name,
        dtype=dtype,
        role=role,
        mean=stats.get("mean"),
        std=stats.get("std"),
        min_val=stats.get("min_val"),
        max_val=stats.get("max_val"),
        null_count=stats.get("null_count"),
        unique_count=stats.get("unique_count")
    )
    db.add(variable)
    db.commit()
    db.refresh(variable)
    return variable


def create_variables_bulk(db: Session, dataset_id: int, variables_data: List[Dict]) -> List[Variable]:
    """Create multiple variables at once"""
    variables = []
    for var_data in variables_data:
        variable = Variable(
            dataset_id=dataset_id,
            name=var_data.get("name"),
            display_name=var_data.get("display_name"),
            dtype=var_data.get("dtype", "numeric"),
            role=var_data.get("role", "feature"),
            mean=var_data.get("mean"),
            std=var_data.get("std"),
            min_val=var_data.get("min_val"),
            max_val=var_data.get("max_val"),
            null_count=var_data.get("null_count"),
            unique_count=var_data.get("unique_count")
        )
        variables.append(variable)
    
    db.add_all(variables)
    db.commit()
    for v in variables:
        db.refresh(v)
    return variables


def get_variables_by_dataset(db: Session, dataset_id: int) -> List[Variable]:
    """Get all variables for a dataset"""
    return db.query(Variable).filter(Variable.dataset_id == dataset_id).all()


def update_variable(db: Session, variable_id: int, **kwargs) -> Optional[Variable]:
    """Update variable fields"""
    variable = db.query(Variable).filter(Variable.id == variable_id).first()
    if variable:
        for key, value in kwargs.items():
            if hasattr(variable, key):
                setattr(variable, key, value)
        db.commit()
        db.refresh(variable)
    return variable


def update_variable_transform(
    db: Session,
    variable_id: int,
    transform_type: str,
    transform_params: Dict = None
) -> Optional[Variable]:
    """Update variable transformation settings"""
    variable = db.query(Variable).filter(Variable.id == variable_id).first()
    if variable:
        variable.transform_type = transform_type
        variable.transform_params = transform_params
        db.commit()
        db.refresh(variable)
    return variable


def update_variable_constraint(db: Session, variable_id: int, constraint: str) -> Optional[Variable]:
    """Update variable constraint (non_positive, non_negative, or None)"""
    variable = db.query(Variable).filter(Variable.id == variable_id).first()
    if variable:
        variable.constraint = constraint
        db.commit()
        db.refresh(variable)
    return variable


# ============== MODEL CRUD ==============
def create_model(
    db: Session,
    user_id: int,
    dataset_id: int,
    name: str,
    model_type: str,
    target_variable: str,
    feature_variables: List[str],
    hyperparameters: Dict = None,
    transform_config: Dict = None,
    constraint_config: Dict = None,
    description: str = None,
    project_id: int = None
) -> Model:
    """Create a new model"""
    model = Model(
        user_id=user_id,
        project_id=project_id,
        dataset_id=dataset_id,
        name=name,
        model_type=model_type,
        target_variable=target_variable,
        feature_variables=feature_variables,
        hyperparameters=hyperparameters,
        transform_config=transform_config,
        constraint_config=constraint_config,
        description=description,
        status="created"
    )
    db.add(model)
    db.commit()
    db.refresh(model)
    return model


def get_models_by_project(db: Session, project_id: int) -> List[Model]:
    """Get all models for a project"""
    return db.query(Model).filter(Model.project_id == project_id).order_by(desc(Model.created_at)).all()


def get_model_by_id(db: Session, model_id: int) -> Optional[Model]:
    """Get model by ID"""
    return db.query(Model).filter(Model.id == model_id).first()


def get_models_by_user(db: Session, user_id: int) -> List[Model]:
    """Get all models for a user"""
    return db.query(Model).filter(Model.user_id == user_id).order_by(desc(Model.created_at)).all()


def get_models_by_dataset(db: Session, dataset_id: int) -> List[Model]:
    """Get all models for a dataset"""
    return db.query(Model).filter(Model.dataset_id == dataset_id).order_by(desc(Model.created_at)).all()


def update_model_status(db: Session, model_id: int, status: str, error_message: str = None) -> Optional[Model]:
    """Update model training status"""
    model = get_model_by_id(db, model_id)
    if model:
        model.status = status
        model.error_message = error_message
        if status == "completed":
            model.trained_at = datetime.utcnow()
        db.commit()
        db.refresh(model)
    return model


def delete_model(db: Session, model_id: int) -> bool:
    """Delete model and all results"""
    model = get_model_by_id(db, model_id)
    if model:
        db.delete(model)
        db.commit()
        return True
    return False


# ============== MODEL RESULT CRUD ==============
def create_model_result(
    db: Session,
    model_id: int,
    metrics: Dict,
    coefficients: Dict,
    predictions: List = None,
    actuals: List = None,
    **kwargs
) -> ModelResult:
    """Create model result after training"""
    result = ModelResult(
        model_id=model_id,
        r2=metrics.get("r2"),
        adj_r2=metrics.get("adj_r2"),
        mape=metrics.get("mape"),
        mae=metrics.get("mae"),
        rmse=metrics.get("rmse"),
        aic=metrics.get("aic"),
        bic=metrics.get("bic"),
        coefficients=coefficients,
        coefficients_instantaneous=kwargs.get("coefficients_instantaneous"),
        std_errors=kwargs.get("std_errors"),
        p_values=kwargs.get("p_values"),
        t_stats=kwargs.get("t_stats"),
        elasticities=kwargs.get("elasticities"),
        contributions=kwargs.get("contributions"),
        vif=kwargs.get("vif"),
        tv_coefficients=kwargs.get("tv_coefficients"),
        q_history=kwargs.get("q_history"),
        r_history=kwargs.get("r_history"),
        adstock_decays=kwargs.get("adstock_decays"),
        logistic_metadata=kwargs.get("logistic_metadata"),
        predictions=predictions,
        actuals=actuals,
        residuals=kwargs.get("residuals")
    )
    db.add(result)
    db.commit()
    db.refresh(result)
    return result


def get_results_by_model(db: Session, model_id: int) -> List[ModelResult]:
    """Get all results for a model"""
    return db.query(ModelResult).filter(ModelResult.model_id == model_id).order_by(desc(ModelResult.created_at)).all()


def get_latest_result(db: Session, model_id: int) -> Optional[ModelResult]:
    """Get the latest result for a model"""
    return db.query(ModelResult).filter(ModelResult.model_id == model_id).order_by(desc(ModelResult.created_at)).first()


def delete_model_results(db: Session, model_id: int) -> int:
    """Delete all results for a model, return count deleted"""
    count = db.query(ModelResult).filter(ModelResult.model_id == model_id).delete()
    db.commit()
    return count
