"""
Database Models - SQLAlchemy ORM definitions
Professional database schema for the modeling application
"""
from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    create_engine, Column, Integer, String, Float, Boolean, 
    DateTime, Text, ForeignKey, JSON, Enum as SQLEnum
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker
import enum

Base = declarative_base()


class ModelType(enum.Enum):
    """Supported model types"""
    OLS = "ols"
    RIDGE = "ridge"
    CONSTRAINED_RIDGE = "constrained_ridge"
    KALMAN = "kalman"
    DECISION_TREE = "decision_tree"
    RANDOM_FOREST = "random_forest"


class VariableRole(enum.Enum):
    """Variable roles in modeling"""
    TARGET = "target"
    FEATURE = "feature"
    GROUP = "group"
    DATE = "date"
    ID = "id"
    EXCLUDED = "excluded"


class TransformType(enum.Enum):
    """Variable transformation types"""
    NONE = "none"
    LOG = "log"
    SQRT = "sqrt"
    ADSTOCK = "adstock"
    SCURVE = "scurve"
    STANDARDIZE = "standardize"


# ============== USER ==============
class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    email = Column(String(255), unique=True, nullable=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    projects = relationship("Project", back_populates="user", cascade="all, delete-orphan")
    datasets = relationship("Dataset", back_populates="user", cascade="all, delete-orphan")
    models = relationship("Model", back_populates="user", cascade="all, delete-orphan")


# ============== PROJECT ==============
class Project(Base):
    __tablename__ = "projects"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(20), default="#10b981")  # Project color for UI
    icon = Column(String(50), default="folder")  # Icon name
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    user = relationship("User", back_populates="projects")
    datasets = relationship("Dataset", back_populates="project", cascade="all, delete-orphan")
    models = relationship("Model", back_populates="project", cascade="all, delete-orphan")


# ============== DATASET ==============
class Dataset(Base):
    __tablename__ = "datasets"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    filename = Column(String(255), nullable=True)
    file_path = Column(String(500), nullable=True)
    file_data = Column(Text, nullable=True)  # Store CSV data as text for persistence
    row_count = Column(Integer, nullable=True)
    column_count = Column(Integer, nullable=True)
    columns_meta = Column(JSON, nullable=True)  # Store column names and types
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="datasets")
    project = relationship("Project", back_populates="datasets")
    variables = relationship("Variable", back_populates="dataset", cascade="all, delete-orphan")
    models = relationship("Model", back_populates="dataset", cascade="all, delete-orphan")


# ============== VARIABLE ==============
class Variable(Base):
    __tablename__ = "variables"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    display_name = Column(String(255), nullable=True)
    dtype = Column(String(50), nullable=True)  # numeric, categorical, datetime
    role = Column(String(50), default="feature")  # target, feature, group, date, id, excluded
    
    # Statistics
    mean = Column(Float, nullable=True)
    std = Column(Float, nullable=True)
    min_val = Column(Float, nullable=True)
    max_val = Column(Float, nullable=True)
    null_count = Column(Integer, nullable=True)
    unique_count = Column(Integer, nullable=True)
    
    # Transform settings
    transform_type = Column(String(50), default="none")
    transform_params = Column(JSON, nullable=True)  # {decay: 0.5, k: 1, x0: 0.5, ...}
    
    # Constraint settings
    constraint = Column(String(50), nullable=True)  # non_positive, non_negative, null
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    dataset = relationship("Dataset", back_populates="variables")


# ============== MODEL ==============
class Model(Base):
    __tablename__ = "models"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
    dataset_id = Column(Integer, ForeignKey("datasets.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    model_type = Column(String(50), nullable=False)  # ols, ridge, kalman, etc.
    
    # Configuration
    target_variable = Column(String(255), nullable=False)
    feature_variables = Column(JSON, nullable=False)  # List of feature names
    hyperparameters = Column(JSON, nullable=True)  # {q: 1e-4, r: 1.0, alpha: 0.1, ...}
    transform_config = Column(JSON, nullable=True)  # {adstock: {...}, scurve: {...}}
    constraint_config = Column(JSON, nullable=True)  # {non_positive: [...], non_negative: [...]}
    
    # Status
    status = Column(String(50), default="created")  # created, training, completed, failed
    error_message = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    trained_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", back_populates="models")
    project = relationship("Project", back_populates="models")
    dataset = relationship("Dataset", back_populates="models")
    results = relationship("ModelResult", back_populates="model", cascade="all, delete-orphan")


# ============== MODEL RESULT ==============
class ModelResult(Base):
    __tablename__ = "model_results"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    model_id = Column(Integer, ForeignKey("models.id"), nullable=False, index=True)
    
    # Metrics
    r2 = Column(Float, nullable=True)
    adj_r2 = Column(Float, nullable=True)
    mape = Column(Float, nullable=True)
    mae = Column(Float, nullable=True)
    rmse = Column(Float, nullable=True)
    aic = Column(Float, nullable=True)
    bic = Column(Float, nullable=True)
    
    # Coefficients (stored as JSON)
    coefficients = Column(JSON, nullable=True)  # {feature: coef, ...}
    coefficients_instantaneous = Column(JSON, nullable=True)
    std_errors = Column(JSON, nullable=True)
    p_values = Column(JSON, nullable=True)
    t_stats = Column(JSON, nullable=True)
    
    # Derived metrics
    elasticities = Column(JSON, nullable=True)
    contributions = Column(JSON, nullable=True)
    vif = Column(JSON, nullable=True)  # Variance Inflation Factors
    
    # Time-varying coefficients (for Kalman)
    tv_coefficients = Column(JSON, nullable=True)  # {feature: [coef_t1, coef_t2, ...]}
    q_history = Column(JSON, nullable=True)
    r_history = Column(JSON, nullable=True)
    
    # Transform metadata (for Kalman)
    adstock_decays = Column(JSON, nullable=True)  # {feature: decay_value, ...}
    logistic_metadata = Column(JSON, nullable=True)  # {feature: {steepness, midpoint, ...}, ...}
    
    # Predictions
    predictions = Column(JSON, nullable=True)  # List of predicted values
    actuals = Column(JSON, nullable=True)  # List of actual values
    residuals = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    model = relationship("Model", back_populates="results")
