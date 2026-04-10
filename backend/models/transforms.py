"""
Data Transformations for MMM
Includes: Geometric Adstock, Logistic S-Curve
Exact replication of Streamlit tv_kalman_app.py implementation
"""
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score
from typing import Dict, List, Optional, Any, Tuple


def geometric_adstock_series(values: np.ndarray, decay: float) -> np.ndarray:
    """
    Apply geometric adstock to a single series.
    Formula: adstocked[t] = values[t] + decay * adstocked[t-1]
    """
    if decay is None or decay <= 0:
        return values.copy()
    adstocked = np.zeros_like(values, dtype=float)
    adstocked[0] = values[0]
    for t in range(1, len(values)):
        adstocked[t] = values[t] + decay * adstocked[t - 1]
    return adstocked


def apply_geometric_adstock(
    df: pd.DataFrame,
    columns: List[str],
    decay: float = 0.5,
    auto: bool = False,
    candidate_decays: Optional[List[float]] = None,
    target_values: Optional[np.ndarray] = None
) -> Tuple[pd.DataFrame, Dict[str, float]]:
    """
    Apply geometric adstock transform to selected columns.
    Exact match to Streamlit apply_geometric_adstock function.
    
    Args:
        df: Input DataFrame
        columns: Columns to transform
        decay: Default decay rate (0-1)
        auto: If True, auto-select best decay per column based on R² with target
        candidate_decays: List of decay values to try in auto mode
        target_values: Target variable for auto-selection
    
    Returns:
        Transformed DataFrame and dict of chosen decays per column
    """
    if not columns:
        return df, {}
    
    if candidate_decays is None:
        candidate_decays = [0.2, 0.4, 0.6, 0.8]
    candidate_decays = [c for c in candidate_decays if 0 < c < 1]
    if not candidate_decays:
        candidate_decays = [0.4]
    
    target_array = None
    if auto and target_values is not None:
        try:
            target_array = np.asarray(target_values, dtype=float)
        except Exception:
            target_array = None
    
    chosen_decays = {}
    df = df.copy()
    
    for col in columns:
        if col not in df.columns:
            continue
        try:
            values = pd.to_numeric(df[col], errors="coerce").fillna(0.0).to_numpy(dtype=float)
        except Exception:
            continue
        if values.size == 0:
            continue
        
        best_decay = decay if decay > 0 else candidate_decays[0]
        best_series = geometric_adstock_series(values, best_decay)
        
        # Auto-select best decay by maximizing R² with target
        if auto and target_array is not None and len(target_array) == len(values):
            best_score = -np.inf
            lr = LinearRegression()
            for d in candidate_decays:
                series = geometric_adstock_series(values, d)
                try:
                    lr.fit(series.reshape(-1, 1), target_array)
                    preds = lr.predict(series.reshape(-1, 1))
                    score = r2_score(target_array, preds)
                except Exception:
                    score = -np.inf
                if not np.isfinite(score):
                    score = -np.inf
                if score > best_score:
                    best_score = score
                    best_decay = d
                    best_series = series
        
        df[col] = best_series
        chosen_decays[col] = best_decay
    
    return df, chosen_decays


def apply_logistic_transform(
    df: pd.DataFrame,
    columns: List[str],
    steepness: float = 1.0,
    midpoint: float = 0.0,
    auto: bool = False,
    candidate_k: Optional[List[float]] = None,
    candidate_midpoints: Optional[List[float]] = None,
    steepness_map: Optional[Dict[str, float]] = None,
    midpoint_map: Optional[Dict[str, float]] = None,
    target_values: Optional[np.ndarray] = None
) -> Tuple[pd.DataFrame, Dict[str, Dict[str, Any]]]:
    """
    Apply logistic S-curve transformation to selected columns.
    Exact match to Streamlit apply_logistic_transform function.
    
    The logistic function: sigma(z) = 1 / (1 + exp(-k * (z - midpoint)))
    where z = (x - median) / scale
    
    Args:
        df: Input DataFrame
        columns: Columns to transform
        steepness: Default steepness parameter k
        midpoint: Default midpoint shift
        auto: If True, auto-select best k per column based on R² with target
        candidate_k: List of k values to try in auto mode
        candidate_midpoints: List of midpoint values to try in auto mode
        steepness_map: Per-column manual steepness overrides
        midpoint_map: Per-column manual midpoint overrides
        target_values: Target variable for auto-selection
    
    Returns:
        Transformed DataFrame and metadata dict per column
    """
    if not columns:
        return df, {}
    
    if candidate_k is None:
        candidate_k = [steepness]
    candidate_k = [float(k) for k in candidate_k if k is not None and np.isfinite(k) and float(k) > 0]
    if not candidate_k:
        candidate_k = [steepness]
    
    if candidate_midpoints is None:
        candidate_midpoints = [midpoint]
    candidate_midpoints = [float(m) for m in candidate_midpoints if m is not None]
    if not candidate_midpoints:
        candidate_midpoints = [midpoint]
    
    steepness_map = steepness_map or {}
    midpoint_map = midpoint_map or {}
    
    target_array = None
    if auto and target_values is not None:
        try:
            target_array = np.asarray(target_values, dtype=float)
        except Exception:
            target_array = None
    
    df = df.copy()
    metadata = {}
    
    for col in columns:
        if col not in df.columns:
            continue
        try:
            series = pd.to_numeric(df[col], errors="coerce").astype(float)
        except Exception:
            continue
        valid = series.dropna()
        if valid.empty:
            continue
        
        # Calculate normalization parameters
        median = float(valid.median())
        scale = float(valid.std(ddof=0))
        if not np.isfinite(scale) or scale == 0.0:
            scale = float(valid.max() - valid.min())
        if not np.isfinite(scale) or scale == 0.0:
            scale = 1.0
        
        min_raw = float(valid.min())
        max_raw = float(valid.max())
        
        # Check for manual overrides
        manual_k = steepness_map.get(col)
        if manual_k is not None:
            try:
                manual_k = float(manual_k)
            except (TypeError, ValueError):
                manual_k = None
        
        manual_midpoint = midpoint_map.get(col)
        if manual_midpoint is not None:
            try:
                manual_midpoint = float(manual_midpoint)
            except (TypeError, ValueError):
                manual_midpoint = None
        
        # Normalize: z = (x - median) / scale
        filled = series.fillna(median).to_numpy(dtype=float)
        centered = filled - median
        base_z = centered / scale
        
        def _apply_params(k_value, midpoint_value):
            z = np.clip(k_value * (base_z - midpoint_value), -60.0, 60.0)
            return 1.0 / (1.0 + np.exp(-z))
        
        chosen_k = manual_k if manual_k is not None else steepness
        chosen_midpoint = manual_midpoint if manual_midpoint is not None else midpoint
        transformed = _apply_params(chosen_k, chosen_midpoint)
        
        # Determine search space
        search_k_values = candidate_k if (manual_k is None and auto) else [chosen_k]
        search_mid_values = candidate_midpoints if (manual_midpoint is None and auto) else [chosen_midpoint]
        
        # Auto-select best parameters by maximizing R² with target
        if (
            auto
            and target_array is not None
            and len(target_array) == len(transformed)
            and (len(search_k_values) > 1 or len(search_mid_values) > 1)
        ):
            best_score = -np.inf
            best_k = chosen_k
            best_mid = chosen_midpoint
            lr = LinearRegression()
            for k_value in search_k_values:
                for midpoint_value in search_mid_values:
                    try:
                        candidate_series = _apply_params(k_value, midpoint_value)
                        lr.fit(candidate_series.reshape(-1, 1), target_array)
                        preds = lr.predict(candidate_series.reshape(-1, 1))
                        score = r2_score(target_array, preds)
                    except Exception:
                        score = -np.inf
                    if not np.isfinite(score):
                        score = -np.inf
                    if score > best_score:
                        best_score = score
                        best_k = float(k_value)
                        best_mid = float(midpoint_value)
                        transformed = candidate_series
            chosen_k = best_k
            chosen_midpoint = best_mid
        
        df[col] = transformed
        
        # Calculate derivative and responsiveness metadata
        last_sigma = float(transformed[-1]) if len(transformed) else float("nan")
        safe_scale = scale if np.isfinite(scale) and scale != 0.0 else 1.0
        k_abs = abs(float(chosen_k)) if np.isfinite(chosen_k) else 0.0
        
        # Mean-based calculations
        if len(series):
            mean_raw = float(series.mean())
        else:
            mean_raw = float("nan")
        
        if np.isfinite(mean_raw):
            mean_centered = (mean_raw - median) / safe_scale
            mean_sigma = float(1.0 / (1.0 + np.exp(-np.clip(chosen_k * (mean_centered - chosen_midpoint), -60.0, 60.0))))
        else:
            mean_sigma = float("nan")
        
        # Derivative at mean (or last value if mean unavailable)
        sigma_for_slope = mean_sigma if np.isfinite(mean_sigma) else last_sigma
        current_derivative = (
            float(sigma_for_slope * (1.0 - sigma_for_slope) * (k_abs / safe_scale))
            if np.isfinite(sigma_for_slope)
            else float("nan")
        )
        max_derivative = float(0.25 * (k_abs / safe_scale))
        
        if not np.isfinite(max_derivative) or max_derivative <= 0:
            responsiveness = float("nan")
        else:
            responsiveness = float(current_derivative / max_derivative)
            responsiveness = float(np.clip(responsiveness, 0.0, 1.0))
        
        # Store full metadata for coefficient interpretation
        metadata[col] = {
            "median": median,
            "scale": scale,
            "steepness": chosen_k,
            "midpoint": chosen_midpoint,
            "reference": median,
            "last_raw": float(series.iloc[-1]) if len(series) else float("nan"),
            "min_raw": min_raw,
            "max_raw": max_raw,
            "last_transformed": last_sigma,
            "mean_raw": mean_raw,
            "mean_transformed": mean_sigma,
            "current_derivative": current_derivative,
            "max_derivative": max_derivative,
            "responsiveness": responsiveness,
        }
    
    return df, metadata


def rescale_betas_to_original(
    betas: np.ndarray,
    scaler_means: Optional[np.ndarray],
    scaler_scales: Optional[np.ndarray],
    feature_names: List[str],
    adstock_map: Optional[Dict[str, float]] = None,
    scurve_map: Optional[Dict[str, Dict[str, Any]]] = None
) -> np.ndarray:
    """
    Convert standardized betas to original feature scale.
    Includes adstock long-run multiplier and logistic derivative adjustments.
    Exact match to Streamlit rescale_betas_to_original function.
    
    Args:
        betas: Array of shape (n_timesteps, n_features) with standardized coefficients
        scaler_means: Mean values from StandardScaler
        scaler_scales: Scale values from StandardScaler
        feature_names: List of feature names (first should be 'Intercept')
        adstock_map: Dict mapping feature name to decay value
        scurve_map: Dict mapping feature name to logistic metadata
    
    Returns:
        Rescaled betas in original feature scale
    """
    if betas is None:
        return betas
    
    betas_orig = betas.copy()
    
    # Step 1: Reverse standardization
    if scaler_means is not None and scaler_scales is not None:
        if betas.shape[1] - 1 == len(scaler_scales):
            safe_scales = np.where(scaler_scales == 0, 1.0, scaler_scales)
            coeffs_std = betas_orig[:, 1:]
            coeffs_orig = coeffs_std / safe_scales
            intercept_adjustment = (coeffs_std * scaler_means / safe_scales).sum(axis=1)
            betas_orig[:, 0] = betas_orig[:, 0] - intercept_adjustment
            betas_orig[:, 1:] = coeffs_orig
    
    # Step 2: Apply adstock long-run scaling
    if adstock_map and feature_names:
        for idx, name in enumerate(feature_names[1:], start=1):
            lam = adstock_map.get(name)
            if lam is None:
                continue
            if lam >= 1.0:
                continue
            # Long-run multiplier: 1 / (1 - decay)
            scale = 1.0 / max(1e-6, 1.0 - lam)
            betas_orig[:, idx] *= scale
    
    # Step 3: Apply logistic (S-curve) derivative adjustment
    if scurve_map and feature_names:
        for idx, name in enumerate(feature_names[1:], start=1):
            meta = scurve_map.get(name)
            if not meta:
                continue
            
            median = float(meta.get("median", 0.0))
            scale = float(meta.get("scale", 1.0))
            k = float(meta.get("steepness", 1.0))
            ref_value = meta.get("reference", median)
            
            if not np.isfinite(scale) or scale == 0.0:
                continue
            if ref_value is None or not np.isfinite(ref_value):
                ref_value = median
            
            # Calculate derivative at reference point
            z = (ref_value - median) / scale
            z = np.clip(k * z, -60.0, 60.0)
            sigma = 1.0 / (1.0 + np.exp(-z))
            derivative = sigma * (1.0 - sigma) * (k / scale)
            
            if not np.isfinite(derivative) or derivative == 0.0:
                continue
            
            betas_orig[:, idx] *= derivative
    
    return betas_orig


def get_long_run_multiplier(decay: float) -> float:
    """
    Calculate the long-run multiplier for adstock.
    This represents the total cumulative effect of a unit impulse.
    
    Formula: 1 / (1 - decay)
    
    Example: decay=0.5 -> multiplier=2.0 (effect doubles over time)
    """
    if decay is None or decay <= 0:
        return 1.0
    if decay >= 1.0:
        return float('inf')
    return 1.0 / (1.0 - decay)


def get_logistic_derivative(
    x: float,
    median: float,
    scale: float,
    steepness: float,
    midpoint: float = 0.0
) -> float:
    """
    Calculate the derivative of the logistic function at point x.
    This is used to convert coefficients from transformed to raw scale.
    
    Formula: d(sigma)/dx = sigma * (1 - sigma) * (k / scale)
    """
    if not np.isfinite(scale) or scale == 0.0:
        return 1.0
    
    z = (x - median) / scale
    z = np.clip(steepness * (z - midpoint), -60.0, 60.0)
    sigma = 1.0 / (1.0 + np.exp(-z))
    derivative = sigma * (1.0 - sigma) * (steepness / scale)
    
    return derivative if np.isfinite(derivative) else 1.0
