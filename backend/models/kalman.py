"""
Time-Varying Kalman Filter for Regression
Based on the Streamlit tv_kalman_app.py implementation
"""
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import Ridge
from sklearn.metrics import r2_score
from typing import Dict, Any, Optional, List
from models.regression import CustomConstrainedRidge


class ConstrainedTVLinearKalman:
    """Time-Varying Linear Kalman Filter with coefficient constraints."""
    
    def __init__(
        self,
        n_features: int,
        q: float = 1e-4,
        r: float = 1.0,
        init_cov: float = 1e3,
        min_pred: float = 0,
        max_pred: Optional[float] = None,
        adaptive: bool = True,
        q_alpha: float = 0.05,
        r_alpha: float = 0.05,
        use_ridge_init: bool = True,
        ridge_alpha: float = 1.0,
        non_negative_features: Optional[List[str]] = None,
        non_positive_features: Optional[List[str]] = None
    ):
        self.n = n_features
        self.q_init = q
        self.r_init = r
        self.q = q
        self.r = r
        self.init_cov = init_cov
        self.Q = np.eye(self.n) * self.q
        self.R = self.r
        self.I = np.eye(self.n)
        self.beta0 = np.zeros(self.n)
        self.P0 = np.eye(self.n) * self.init_cov
        self.min_pred = min_pred
        self.max_pred = max_pred
        self.adaptive = adaptive
        self.q_alpha = float(q_alpha)
        self.r_alpha = float(r_alpha)
        self.use_ridge_init = bool(use_ridge_init)
        self.ridge_alpha = float(ridge_alpha)
        self.non_negative_features = set(non_negative_features or [])
        self.non_positive_features = set(non_positive_features or [])
        self.feature_names = None
        self._nonneg_idx = []
        self._nonpos_idx = []
        
        # Adaptive bounds
        self.q_min = q * 0.1
        self.q_max = q * 10
        self.r_min = r * 0.1
        self.r_max = r * 10
        self.last_beta_upd = None
        self.innovations = []
    
    def _step(self, x_t, y_t, beta_prev, P_prev, update=True):
        x_t = x_t.reshape(-1, 1)
        beta_pred = beta_prev.copy()
        P_pred = P_prev + self.Q
        y_pred_raw = (beta_pred @ x_t).item()
        y_pred_display = y_pred_raw

        if self.min_pred is not None:
            y_pred_display = max(y_pred_display, self.min_pred)
        if self.max_pred is not None:
            y_pred_display = min(y_pred_display, self.max_pred)

        innovation = None
        if update and np.isfinite(y_t):
            resid = y_t - y_pred_raw
            S = (x_t.T @ P_pred @ x_t).item() + self.R
            if not np.isfinite(S) or S <= 1e-12:
                S = 1e-12
            K = (P_pred @ x_t) / S
            beta_upd = beta_pred + K.flatten() * resid
            temp = self.I - K @ x_t.T
            P_upd = temp @ P_pred @ temp.T + (K @ K.T) * self.R

            if self._nonneg_idx or self._nonpos_idx:
                self._project_state(beta_upd, P_upd)
            innovation = float(resid)

            # Adaptive updates
            if self.adaptive:
                s_state = float((x_t.T @ P_pred @ x_t).item())
                s_state = max(0.0, s_state)
                innovation_var = resid * resid
                r_sample = innovation_var - s_state
                if not np.isfinite(r_sample) or r_sample <= 0:
                    r_sample = max(self.r_min, innovation_var)
                r_sample = min(max(r_sample, self.r_min), self.r_max)
                self.r = (1.0 - self.r_alpha) * self.r + self.r_alpha * r_sample
                self.R = self.r

                if self.last_beta_upd is not None:
                    delta = beta_upd - self.last_beta_upd
                    q_sample = float(np.mean(delta * delta))
                    q_sample = max(1e-16, q_sample)
                    q_sample = min(max(q_sample, self.q_min), self.q_max)
                    self.q = (1.0 - self.q_alpha) * self.q + self.q_alpha * q_sample
                    self.Q = np.eye(self.n) * self.q
                self.last_beta_upd = beta_upd.copy()
        else:
            beta_upd = beta_pred.copy()
            P_upd = P_pred.copy()
            if self.last_beta_upd is None:
                self.last_beta_upd = beta_upd.copy()

        if update and np.isfinite(y_t):
            if innovation is None:
                innovation = float(y_t - y_pred_raw)
            self.innovations.append(float(innovation))

        return beta_pred, P_pred, y_pred_display, beta_upd, P_upd

    def _project_state(self, beta_vec, cov_mat):
        """Project state to satisfy sign constraints."""
        active = []
        seen = set()
        for idx in self._nonneg_idx:
            if beta_vec[idx] < 0 and idx not in seen:
                active.append(idx)
                seen.add(idx)
        for idx in self._nonpos_idx:
            if beta_vec[idx] > 0 and idx not in seen:
                active.append(idx)
                seen.add(idx)
        if not active:
            return
        active = np.array(active, dtype=int)
        k = active.shape[0]
        if k == 0:
            return

        P_cc = cov_mat[np.ix_(active, active)]
        jitter = 1e-9
        I_k = np.eye(k)
        for _ in range(6):
            try:
                reg = P_cc + jitter * I_k
                solve_beta = np.linalg.solve(reg, beta_vec[active])
                solve_cov = np.linalg.solve(reg, cov_mat[active, :])
                break
            except np.linalg.LinAlgError:
                jitter *= 10.0
        else:
            reg = P_cc + jitter * I_k
            solve_beta = np.linalg.pinv(reg) @ beta_vec[active]
            solve_cov = np.linalg.pinv(reg) @ cov_mat[active, :]

        beta_vec -= cov_mat[:, active] @ solve_beta
        beta_vec[active] = 0.0
        cov_mat -= cov_mat[:, active] @ solve_cov
        cov_mat[:] = 0.5 * (cov_mat + cov_mat.T)

    def fit(self, X_train, y_train, feature_names=None):
        T, p = X_train.shape
        betas_filt = np.zeros((T, p))
        y_pred = np.zeros(T)
        
        self.q_history = []
        self.r_history = []
        
        self.last_beta_upd = None
        self.innovations = []
        beta = self.beta0.copy()

        if feature_names is not None:
            self.feature_names = list(feature_names)
        else:
            self.feature_names = [f"feature_{i}" for i in range(p)]
        
        self._nonneg_idx = [i for i, name in enumerate(self.feature_names) if name in self.non_negative_features]
        self._nonpos_idx = [i for i, name in enumerate(self.feature_names) if name in self.non_positive_features]

        has_constraints = bool(self.non_negative_features or self.non_positive_features)

        # Ridge initialization - use constrained ridge if there are sign constraints
        if self.use_ridge_init:
            try:
                if has_constraints:
                    # Use CustomConstrainedRidge when we have sign constraints
                    names = self.feature_names
                    intercept_first = bool(names) and names[0].lower() == 'intercept'
                    
                    if intercept_first:
                        X_solver = X_train[:, 1:]
                        solver_names = names[1:]
                    else:
                        X_solver = X_train
                        solver_names = names

                    beta = self.beta0.copy()
                    if X_solver.shape[1] > 0:
                        solver = CustomConstrainedRidge(
                            l2_penalty=self.ridge_alpha,
                            non_negative_features=list(self.non_negative_features),
                            non_positive_features=list(self.non_positive_features)
                        )
                        solver.fit(X_solver, y_train, solver_names)
                        if intercept_first:
                            beta[0] = solver.intercept_
                            beta[1:1 + len(solver.coef_)] = solver.coef_
                        else:
                            beta[:len(solver.coef_)] = solver.coef_
                            beta[0] = solver.intercept_
                    else:
                        beta[0] = float(np.mean(y_train))
                else:
                    # Standard Ridge when no constraints
                    ridge = Ridge(alpha=self.ridge_alpha, fit_intercept=False)
                    ridge.fit(X_train, y_train)
                    coef = ridge.coef_.astype(float)
                    if coef.shape[0] == self.n:
                        beta = coef
                    else:
                        beta[:len(coef)] = coef
            except Exception:
                beta = self.beta0.copy()

        if not np.isfinite(beta).all():
            beta = self.beta0.copy()
        P = self.P0.copy()
        
        for t in range(T):
            _, _, yhat, beta_upd, P_upd = self._step(X_train[t], y_train[t], beta, P, update=True)
            betas_filt[t] = beta_upd
            y_pred[t] = yhat
            beta = beta_upd
            P = P_upd
            
            if self.adaptive:
                self.q_history.append(self.q)
                self.r_history.append(self.r)
        
        return betas_filt, y_pred


def safe_mape(y_true, y_pred):
    """MAPE calculation."""
    y_true = np.array(y_true)
    y_pred = np.array(y_pred)
    mask = y_true != 0
    if mask.sum() == 0:
        return 0.0
    return float(np.mean(np.abs((y_true[mask] - y_pred[mask]) / y_true[mask])) * 100)


def run_kalman_filter(
    X: pd.DataFrame,
    y: pd.Series,
    q: float = 1e-4,
    r: float = 1.0,
    adaptive: bool = True,
    standardize: bool = True,
    non_positive_features: Optional[List[str]] = None,
    non_negative_features: Optional[List[str]] = None,
    adstock_map: Optional[Dict[str, float]] = None,
    scurve_map: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Run Time-Varying Kalman Filter regression.
    
    Args:
        X: Feature DataFrame (already transformed if adstock/logistic applied)
        y: Target Series
        q: Process noise variance
        r: Measurement noise variance
        adaptive: Enable adaptive Q and R estimation
        standardize: Standardize features before fitting
        non_positive_features: Features constrained to have coef <= 0
        non_negative_features: Features constrained to have coef >= 0
        adstock_map: Dict of {column: decay} for adstock long-run multiplier adjustment
        scurve_map: Dict of {column: metadata} for logistic derivative adjustment
    
    Returns:
        Dict with predictions, coefficients, metrics, etc.
    """
    X_full = X.copy().fillna(0)
    y_full = y.copy().fillna(0)
    feature_cols = list(X_full.columns)
    
    # Build design matrix with intercept
    X_values = X_full.values.astype(float)
    scaler = None
    scaler_means = None
    scaler_scales = None
    
    if standardize:
        scaler = StandardScaler()
        X_values = scaler.fit_transform(X_values)
        scaler_means = scaler.mean_
        scaler_scales = scaler.scale_
    
    # Add intercept column
    ones = np.ones((X_values.shape[0], 1), dtype=float)
    X_design = np.hstack([ones, X_values])
    cols_with_intercept = ['Intercept'] + feature_cols
    
    n_features = X_design.shape[1]
    y_values = y_full.values.astype(float)
    
    # Initialize and fit Kalman filter
    kf = ConstrainedTVLinearKalman(
        n_features=n_features,
        q=q,
        r=r,
        adaptive=adaptive,
        non_negative_features=non_negative_features,
        non_positive_features=non_positive_features
    )
    
    betas_filtered, y_pred = kf.fit(X_design, y_values, feature_names=cols_with_intercept)
    
    # Import rescaling function
    from models.transforms import rescale_betas_to_original
    
    # Rescale betas to original scale (standardization + adstock + logistic)
    betas_rescaled = rescale_betas_to_original(
        betas=betas_filtered,
        scaler_means=scaler_means,
        scaler_scales=scaler_scales,
        feature_names=cols_with_intercept,
        adstock_map=adstock_map,
        scurve_map=scurve_map
    )
    
    # Also get coefficients without adstock/logistic adjustment (instantaneous)
    betas_instantaneous = rescale_betas_to_original(
        betas=betas_filtered,
        scaler_means=scaler_means,
        scaler_scales=scaler_scales,
        feature_names=cols_with_intercept,
        adstock_map=None,  # No adstock adjustment
        scurve_map=None    # No logistic adjustment
    )
    
    # Metrics
    r2 = float(r2_score(y_values, y_pred))
    mape = safe_mape(y_values, y_pred)
    mae = float(np.mean(np.abs(y_values - y_pred)))
    
    # Final coefficients (with full rescaling including adstock/logistic)
    final_betas = betas_rescaled[-1, :]
    coefficients = {col: float(final_betas[i]) for i, col in enumerate(cols_with_intercept)}
    
    # Instantaneous coefficients (before long-run/derivative adjustment)
    final_betas_inst = betas_instantaneous[-1, :]
    coefficients_instantaneous = {col: float(final_betas_inst[i]) for i, col in enumerate(cols_with_intercept)}
    
    # Time-varying coefficients for each feature (rescaled)
    tv_coefficients = {}
    for i, col in enumerate(cols_with_intercept):
        tv_coefficients[col] = betas_rescaled[:, i].tolist()
    
    # Elasticities (using final coefficients)
    # Note: For transformed features, elasticity interpretation changes
    y_mean = float(y_values.mean())
    elasticities = {}
    for col in feature_cols:
        coef = coefficients.get(col, 0)
        x_mean = float(X_full[col].mean())
        elasticities[col] = float((coef * x_mean) / y_mean) if y_mean != 0 else 0.0
    
    # Contributions
    contrib_values = {}
    for col in feature_cols:
        coef = coefficients.get(col, 0)
        x_mean = float(X_full[col].mean())
        contrib_values[col] = coef * x_mean
    
    total_abs_contrib = sum(abs(v) for v in contrib_values.values())
    contributions = {}
    if total_abs_contrib > 0:
        for col in feature_cols:
            contributions[col] = float((contrib_values[col] / total_abs_contrib) * 100)
    else:
        contributions = {col: 0.0 for col in feature_cols}
    
    return {
        "predictions": y_pred.tolist(),
        "actuals": y_values.tolist(),
        "metrics": {
            "r2": r2,
            "mape": mape,
            "mae": mae,
        },
        "coefficients": coefficients,
        "coefficients_instantaneous": coefficients_instantaneous,
        "tv_coefficients": tv_coefficients,
        "elasticities": elasticities,
        "contributions": contributions,
        "q_history": kf.q_history if adaptive else [],
        "r_history": kf.r_history if adaptive else [],
    }
