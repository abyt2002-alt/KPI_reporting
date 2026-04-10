"""
Regression Models - Matching Streamlit Implementation
Uses exact same mathematical approach as the reference Streamlit app
"""
import numpy as np
import pandas as pd
from sklearn.linear_model import LinearRegression, Ridge, Lasso, ElasticNet, BayesianRidge
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import r2_score
from sklearn.base import BaseEstimator, RegressorMixin
from typing import Dict, Any, Optional, List


# ============== CUSTOM CONSTRAINED RIDGE ==============

class CustomConstrainedRidge(BaseEstimator, RegressorMixin):
    """Ridge regression with coefficient sign constraints - matches Streamlit version"""

    def __init__(self, l2_penalty=0.1, learning_rate=0.001, iterations=10000,
                 non_positive_features: Optional[List[str]] = None,
                 non_negative_features: Optional[List[str]] = None):
        self.l2_penalty = l2_penalty
        self.learning_rate = learning_rate
        self.iterations = iterations
        self.non_positive_features = tuple(non_positive_features) if non_positive_features else ()
        self.non_negative_features = tuple(non_negative_features) if non_negative_features else ()

    def fit(self, X, Y, feature_names):
        X_arr = X.values if hasattr(X, 'values') else np.array(X)
        Y_arr = Y.values if hasattr(Y, 'values') else np.array(Y)

        self.m, self.n = X_arr.shape
        self.W = np.zeros(self.n)
        self.b = 0
        self.X = X_arr
        self.Y = Y_arr
        self.feature_names = feature_names

        configured_non_positive = set(self.non_positive_features) if self.non_positive_features else set()
        configured_non_negative = set(self.non_negative_features) if self.non_negative_features else set()

        self._non_positive_indices = [i for i, name in enumerate(feature_names) if name in configured_non_positive]
        self._non_negative_indices = [i for i, name in enumerate(feature_names) if name in configured_non_negative]

        for _ in range(self.iterations):
            self._update_weights()

        self.intercept_ = self.b
        self.coef_ = self.W
        return self

    def _update_weights(self):
        Y_pred = self.predict(self.X)
        grad_w = (-(2 * (self.X.T).dot(self.Y - Y_pred)) + 2 * self.l2_penalty * self.W) / self.m
        grad_b = -(2 / self.m) * np.sum(self.Y - Y_pred)

        self.W -= self.learning_rate * grad_w
        self.b -= self.learning_rate * grad_b

        if self._non_positive_indices:
            self.W[self._non_positive_indices] = np.minimum(self.W[self._non_positive_indices], 0)
        if self._non_negative_indices:
            self.W[self._non_negative_indices] = np.maximum(self.W[self._non_negative_indices], 0)

    def predict(self, X):
        X_arr = X.values if hasattr(X, 'values') else np.array(X)
        return X_arr.dot(self.W) + self.b


# ============== HELPER FUNCTIONS ==============

def safe_mape(y_true, y_pred):
    """MAPE calculation matching Streamlit version"""
    y_true = np.array(y_true)
    y_pred = np.array(y_pred)
    mask = y_true != 0
    if mask.sum() == 0:
        return 0.0
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100)


# ============== MAIN REGRESSION FUNCTION ==============

def run_regression(
    X: pd.DataFrame,
    y: pd.Series,
    model_type: str = "linear",
    standardization: str = "none",
    test_size: float = 0.2,
    non_positive_features: Optional[List[str]] = None,
    non_negative_features: Optional[List[str]] = None,
    remove_outliers: bool = False
) -> Dict[str, Any]:
    """
    Run regression - matches Streamlit pipeline approach exactly
    """
    # ===== SETUP =====
    X_full = X.copy().fillna(0)
    y_full = y.copy()
    feature_cols = list(X_full.columns)

    # ===== OUTLIER DETECTION =====
    n_outliers = 0
    outlier_indices = []

    if remove_outliers:
        Q1 = y_full.quantile(0.25)
        Q3 = y_full.quantile(0.75)
        IQR = Q3 - Q1
        lower_bound = Q1 - 1.5 * IQR
        upper_bound = Q3 + 1.5 * IQR

        outlier_mask = (y_full >= lower_bound) & (y_full <= upper_bound)
        n_outliers = (~outlier_mask).sum()
        outlier_indices = y_full[~outlier_mask].index.tolist()

        X_full = X_full[outlier_mask].reset_index(drop=True)
        y_full = y_full[outlier_mask].reset_index(drop=True)

    # ===== SEQUENTIAL TRAIN/TEST SPLIT (like time series) =====
    n_samples = len(X_full)
    split_idx = int(n_samples * (1 - test_size))

    X_tr = X_full.iloc[:split_idx].copy()
    X_te = X_full.iloc[split_idx:].copy()
    y_tr = y_full.iloc[:split_idx].copy()
    y_te = y_full.iloc[split_idx:].copy()

    # Store original y for metrics
    y_tr_original = y_tr.copy()
    y_te_original = y_te.copy()

    # ===== STANDARDIZATION (fit on TRAIN only) =====
    scaler = {}
    std_cols = feature_cols if standardization == "standardize" else []

    if std_cols:
        sc = StandardScaler().fit(X_tr[std_cols])
        X_tr[std_cols] = sc.transform(X_tr[std_cols])
        X_te[std_cols] = sc.transform(X_te[std_cols])
        # Also transform full data for predictions
        X_full_scaled = X_full.copy()
        X_full_scaled[std_cols] = sc.transform(X_full[std_cols])
        scaler = {c: (m, s) for c, m, s in zip(std_cols, sc.mean_, sc.scale_)}
    else:
        X_full_scaled = X_full.copy()

    # ===== FIT MODEL =====
    if model_type == "constrained_ridge":
        model = CustomConstrainedRidge(
            l2_penalty=0.1,
            learning_rate=0.001,
            iterations=10000,
            non_positive_features=non_positive_features or [],
            non_negative_features=non_negative_features or []
        )
        model.fit(X_tr.values, y_tr.values, feature_cols)
        y_tr_pred = model.predict(X_tr.values)
        y_te_pred = model.predict(X_te.values)
        y_full_pred = model.predict(X_full_scaled.values)
        B0_std = model.intercept_
        B1_std = model.coef_.copy()
    else:
        models = {
            "linear": LinearRegression(),
            "ridge": Ridge(alpha=1.0),
            "lasso": Lasso(alpha=1.0),
            "elasticnet": ElasticNet(alpha=1.0, l1_ratio=0.5),
            "bayesian": BayesianRidge()
        }
        model = models.get(model_type, LinearRegression())
        model.fit(X_tr, y_tr)
        y_tr_pred = model.predict(X_tr)
        y_te_pred = model.predict(X_te)
        y_full_pred = model.predict(X_full_scaled)
        B0_std = model.intercept_
        B1_std = model.coef_.copy()

    # ===== METRICS (on original scale) =====
    # R2
    r2_tr = float(r2_score(y_tr_original, y_tr_pred))
    r2_te = float(r2_score(y_te_original, y_te_pred))
    r2_full = float(r2_score(y_full, y_full_pred))
    
    # MAPE
    mape_tr = safe_mape(y_tr_original, y_tr_pred)
    mape_te = safe_mape(y_te_original, y_te_pred)
    mape_full = safe_mape(y_full, y_full_pred)
    
    # MAE
    mae_full = float(np.mean(np.abs(y_full - y_full_pred)))
    
    # MSE
    mse_full = float(np.mean((y_full - y_full_pred) ** 2))
    
    # RMSE
    rmse_full = float(np.sqrt(mse_full))
    
    # AIC and BIC (using full data)
    n = len(y_full)
    k = len(feature_cols) + 1  # number of parameters (coefficients + intercept)
    
    # Log-likelihood (assuming Gaussian errors)
    residuals = y_full - y_full_pred
    ss_res = float(np.sum(residuals ** 2))
    
    # AIC = n * ln(SS_res/n) + 2k
    aic = float(n * np.log(ss_res / n) + 2 * k) if ss_res > 0 else 0.0
    
    # BIC = n * ln(SS_res/n) + k * ln(n)
    bic = float(n * np.log(ss_res / n) + k * np.log(n)) if ss_res > 0 else 0.0

    # ===== REVERSE STANDARDIZATION ON COEFFICIENTS =====
    # This is the exact approach from Streamlit:
    # raw_coefs[i] = raw_coefs[i] / sd
    # raw_int -= raw_coefs[i] * mu
    raw_int = float(B0_std)
    raw_coefs = B1_std.copy()

    for i, col in enumerate(feature_cols):
        if col in scaler:
            mu, sd = scaler[col]
            raw_coefs[i] = raw_coefs[i] / sd
            raw_int -= raw_coefs[i] * mu

    # ===== BUILD COEFFICIENTS DICT =====
    coefficients = {col: float(raw_coefs[i]) for i, col in enumerate(feature_cols)}
    coefficients["intercept"] = raw_int

    # Transformed coefficients (before reverse standardization)
    coefficients_transformed = {col: float(B1_std[i]) for i, col in enumerate(feature_cols)}
    coefficients_transformed["intercept"] = float(B0_std)

    # ===== MEAN X (from TRAIN data only - no leakage) =====
    mean_x = X_tr.mean(numeric_only=True).to_dict()

    # ===== ELASTICITY =====
    # Elasticity = (coef * mean_x) / mean_y
    y_mean = float(y_tr_original.mean())
    elasticities = {}
    for col in feature_cols:
        coef = coefficients[col]
        x_mean = mean_x.get(col, 0)
        elasticities[col] = float((coef * x_mean) / y_mean) if y_mean != 0 else 0.0

    # ===== BETA (Standardized Coefficients) =====
    # Beta = coef * (std_x / std_y)
    y_std = float(y_tr_original.std())
    betas = {}
    for col in feature_cols:
        coef = coefficients[col]
        x_std = float(X_tr[col].std()) if col not in scaler else scaler[col][1]
        betas[col] = float(coef * (x_std / y_std)) if y_std != 0 else 0.0

    # ===== CONTRIBUTIONS =====
    # Contribution = (coef * mean_x) / sum(|coef * mean_x|) * 100
    contrib_values = {}
    for col in feature_cols:
        coef = coefficients[col]
        x_mean = mean_x.get(col, 0)
        contrib_values[col] = coef * x_mean

    total_abs_contrib = sum(abs(v) for v in contrib_values.values())
    contributions = {}
    if total_abs_contrib > 0:
        for col in feature_cols:
            contributions[col] = float((contrib_values[col] / total_abs_contrib) * 100)
    else:
        contributions = {col: 0.0 for col in feature_cols}

    # ===== BUILD RESPONSE =====
    metrics = {
        "r2": r2_full,
        "mape": mape_full,
        "mae": mae_full,
        "aic": aic,
        "bic": bic,
        "n_outliers": int(n_outliers),
    }

    return {
        "predictions": y_full_pred.tolist(),
        "actuals": y_full.tolist(),
        "outlier_indices": outlier_indices,
        "metrics": metrics,
        "coefficients": coefficients,
        "coefficients_transformed": coefficients_transformed,
        "elasticities": elasticities,
        "betas": betas,
        "contributions": contributions,
        "standardization_used": standardization,
        "model_type": model_type
    }
