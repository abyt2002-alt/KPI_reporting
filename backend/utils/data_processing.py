"""
Data Processing Utilities
"""
import pandas as pd
import numpy as np
from typing import List, Dict, Any, Optional


def clean_data(df: pd.DataFrame, fill_method: str = "mean") -> pd.DataFrame:
    """Clean dataframe - handle missing values"""
    df_clean = df.copy()
    
    for col in df_clean.columns:
        if df_clean[col].dtype in ['float64', 'int64']:
            if fill_method == "mean":
                df_clean[col].fillna(df_clean[col].mean(), inplace=True)
            elif fill_method == "median":
                df_clean[col].fillna(df_clean[col].median(), inplace=True)
            elif fill_method == "zero":
                df_clean[col].fillna(0, inplace=True)
        else:
            df_clean[col].fillna("Unknown", inplace=True)
    
    return df_clean


def normalize_data(df: pd.DataFrame, columns: List[str], method: str = "minmax") -> pd.DataFrame:
    """Normalize numeric columns"""
    df_norm = df.copy()
    
    for col in columns:
        if col in df_norm.columns and df_norm[col].dtype in ['float64', 'int64']:
            if method == "minmax":
                min_val = df_norm[col].min()
                max_val = df_norm[col].max()
                if max_val > min_val:
                    df_norm[col] = (df_norm[col] - min_val) / (max_val - min_val)
            elif method == "zscore":
                mean_val = df_norm[col].mean()
                std_val = df_norm[col].std()
                if std_val > 0:
                    df_norm[col] = (df_norm[col] - mean_val) / std_val
    
    return df_norm


def calculate_statistics(df: pd.DataFrame, columns: Optional[List[str]] = None) -> Dict[str, Dict[str, float]]:
    """Calculate descriptive statistics"""
    if columns is None:
        columns = df.select_dtypes(include=[np.number]).columns.tolist()
    
    stats = {}
    for col in columns:
        if col in df.columns:
            stats[col] = {
                "mean": float(df[col].mean()),
                "median": float(df[col].median()),
                "std": float(df[col].std()),
                "min": float(df[col].min()),
                "max": float(df[col].max()),
                "count": int(df[col].count()),
                "missing": int(df[col].isna().sum())
            }
    
    return stats
