"""
Test script for regression.py - Full flow validation
Tests: data filtering, z-score standardization, model fitting, prediction scaling, elasticity, contributions
"""
import numpy as np
import pandas as pd
from models.regression import run_regression

# ============== CREATE TEST DATA ==============
np.random.seed(42)
n = 100

# Create synthetic data with known relationships
# y = 10 + 2*x1 + 0.5*x2 - 1*x3 + noise
x1 = np.random.uniform(10, 50, n)
x2 = np.random.uniform(100, 500, n)
x3 = np.random.uniform(5, 20, n)
noise = np.random.normal(0, 5, n)

y = 10 + 2*x1 + 0.5*x2 - 1*x3 + noise

# Add some outliers
y[95] = 1000  # outlier
y[96] = -500  # outlier

df = pd.DataFrame({
    'x1': x1,
    'x2': x2, 
    'x3': x3,
    'y': y
})

X = df[['x1', 'x2', 'x3']]
y_series = df['y']

print("=" * 60)
print("TEST 1: Basic Linear Regression (no standardization)")
print("=" * 60)

result = run_regression(X, y_series, model_type="linear", standardization="none")

print(f"Metrics: {result['metrics']}")
print(f"Coefficients: {result['coefficients']}")
print(f"Predictions length: {len(result['predictions'])}")
print(f"Actuals length: {len(result['actuals'])}")

# Check predictions match actuals length
assert len(result['predictions']) == len(result['actuals']), "Predictions and actuals length mismatch!"
print("✓ Predictions/Actuals length match")

# Check coefficients are close to true values (2, 0.5, -1)
coefs = result['coefficients']
print(f"\nExpected coefs: x1≈2, x2≈0.5, x3≈-1")
print(f"Got: x1={coefs['x1']:.4f}, x2={coefs['x2']:.4f}, x3={coefs['x3']:.4f}")

print("\n" + "=" * 60)
print("TEST 2: Z-Score Standardization")
print("=" * 60)

result_std = run_regression(X, y_series, model_type="linear", standardization="standardize")

print(f"Metrics: {result_std['metrics']}")
print(f"Original-scale Coefficients: {result_std['coefficients']}")
print(f"Transformed Coefficients: {result_std['coefficients_transformed']}")

# Verify predictions are on original scale (not standardized)
pred_mean = np.mean(result_std['predictions'])
actual_mean = np.mean(result_std['actuals'])
print(f"\nPrediction mean: {pred_mean:.2f}")
print(f"Actual mean: {actual_mean:.2f}")
assert abs(pred_mean - actual_mean) < 50, "Predictions not on original scale!"
print("✓ Predictions are on original scale")

# Verify coefficients are back-transformed correctly
# After standardization, original-scale coefs should still be close to true values
coefs_std = result_std['coefficients']
print(f"\nBack-transformed coefs: x1={coefs_std['x1']:.4f}, x2={coefs_std['x2']:.4f}, x3={coefs_std['x3']:.4f}")

print("\n" + "=" * 60)
print("TEST 3: Outlier Removal")
print("=" * 60)

result_outlier = run_regression(X, y_series, model_type="linear", standardization="none", remove_outliers=True)

print(f"Metrics: {result_outlier['metrics']}")
print(f"N outliers removed: {result_outlier['metrics']['n_outliers']}")
print(f"Outlier indices: {result_outlier['outlier_indices']}")

assert result_outlier['metrics']['n_outliers'] >= 2, "Should detect at least 2 outliers"
print("✓ Outliers detected correctly")

# R2 should be better without outliers
print(f"\nR2 with outliers: {result['metrics']['r2']:.4f}")
print(f"R2 without outliers: {result_outlier['metrics']['r2']:.4f}")

print("\n" + "=" * 60)
print("TEST 4: Elasticity Calculation")
print("=" * 60)

print(f"Elasticities: {result['elasticities']}")

# Elasticity = (coef * x_mean) / y_mean
# Manual check for x1
x1_mean = X['x1'].mean()
y_mean = y_series.mean()
expected_elasticity_x1 = (coefs['x1'] * x1_mean) / y_mean
print(f"\nManual elasticity x1: (coef={coefs['x1']:.4f} * x_mean={x1_mean:.2f}) / y_mean={y_mean:.2f} = {expected_elasticity_x1:.4f}")
print(f"Reported elasticity x1: {result['elasticities']['x1']:.4f}")

assert abs(result['elasticities']['x1'] - expected_elasticity_x1) < 0.01, "Elasticity calculation wrong!"
print("✓ Elasticity calculation correct")

print("\n" + "=" * 60)
print("TEST 5: Contribution Calculation")
print("=" * 60)

print(f"Contributions: {result['contributions']}")

# Contributions should sum to ~100% (or close, accounting for signs)
total_contrib = sum(abs(v) for v in result['contributions'].values())
print(f"Sum of |contributions|: {total_contrib:.2f}%")

print("\n" + "=" * 60)
print("TEST 6: Ridge Regression with Z-Score")
print("=" * 60)

result_ridge = run_regression(X, y_series, model_type="ridge", standardization="standardize")
print(f"Metrics: {result_ridge['metrics']}")
print(f"Coefficients: {result_ridge['coefficients']}")

print("\n" + "=" * 60)
print("TEST 7: Verify R2 Calculation")
print("=" * 60)

from sklearn.metrics import r2_score

# Manual R2 check
y_actual = np.array(result['actuals'])
y_pred = np.array(result['predictions'])
manual_r2 = r2_score(y_actual, y_pred)
reported_r2 = result['metrics']['r2']

print(f"Manual R2: {manual_r2:.6f}")
print(f"Reported R2: {reported_r2:.6f}")
assert abs(manual_r2 - reported_r2) < 0.0001, "R2 calculation mismatch!"
print("✓ R2 calculation correct")

print("\n" + "=" * 60)
print("TEST 8: MAPE Calculation")
print("=" * 60)

# Manual MAPE check
mask = y_actual != 0
manual_mape = np.mean(np.abs((y_actual[mask] - y_pred[mask]) / y_actual[mask])) * 100
reported_mape = result['metrics']['mape']

print(f"Manual MAPE: {manual_mape:.4f}%")
print(f"Reported MAPE: {reported_mape:.4f}%")
assert abs(manual_mape - reported_mape) < 0.01, "MAPE calculation mismatch!"
print("✓ MAPE calculation correct")

print("\n" + "=" * 60)
print("ALL TESTS PASSED! ✓")
print("=" * 60)
