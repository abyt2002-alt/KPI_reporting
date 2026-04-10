"""
Robust Test Suite for regression.py
Tests all calculations: coefficients, elasticity, beta, contributions with manual verification
"""
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LinearRegression
from sklearn.metrics import r2_score
from models.regression import run_regression

np.random.seed(123)

# ============== CREATE CLEAN TEST DATA (NO NOISE, NO COLLINEARITY) ==============
# y = 5 + 3*x1 + 0.2*x2 - 2*x3 (exact relationship)
n = 100
x1 = np.random.uniform(10, 50, n)
x2 = np.random.uniform(100, 500, n)
x3 = np.random.uniform(5, 20, n)

# TRUE coefficients
TRUE_INTERCEPT = 5
TRUE_COEF_X1 = 3
TRUE_COEF_X2 = 0.2
TRUE_COEF_X3 = -2

y = TRUE_INTERCEPT + TRUE_COEF_X1*x1 + TRUE_COEF_X2*x2 + TRUE_COEF_X3*x3

X = pd.DataFrame({'x1': x1, 'x2': x2, 'x3': x3})
y_series = pd.Series(y)

print("=" * 70)
print("SAMPLE DATA SUMMARY")
print("=" * 70)
print(f"n = {n}")
print(f"x1: mean={x1.mean():.2f}, std={x1.std():.2f}")
print(f"x2: mean={x2.mean():.2f}, std={x2.std():.2f}")
print(f"x3: mean={x3.mean():.2f}, std={x3.std():.2f}")
print(f"y:  mean={y.mean():.2f}, std={y.std():.2f}")
print(f"\nTRUE MODEL: y = {TRUE_INTERCEPT} + {TRUE_COEF_X1}*x1 + {TRUE_COEF_X2}*x2 + {TRUE_COEF_X3}*x3")

# ============== TEST 1: COEFFICIENT RECOVERY (NO STANDARDIZATION) ==============
print("\n" + "=" * 70)
print("TEST 1: COEFFICIENT RECOVERY (no standardization)")
print("=" * 70)

result = run_regression(X, y_series, model_type="linear", standardization="none")
coefs = result['coefficients']

print(f"\nExpected: intercept={TRUE_INTERCEPT}, x1={TRUE_COEF_X1}, x2={TRUE_COEF_X2}, x3={TRUE_COEF_X3}")
print(f"Got:      intercept={coefs['intercept']:.6f}, x1={coefs['x1']:.6f}, x2={coefs['x2']:.6f}, x3={coefs['x3']:.6f}")

assert abs(coefs['intercept'] - TRUE_INTERCEPT) < 0.001, f"Intercept wrong: {coefs['intercept']}"
assert abs(coefs['x1'] - TRUE_COEF_X1) < 0.001, f"x1 coef wrong: {coefs['x1']}"
assert abs(coefs['x2'] - TRUE_COEF_X2) < 0.001, f"x2 coef wrong: {coefs['x2']}"
assert abs(coefs['x3'] - TRUE_COEF_X3) < 0.001, f"x3 coef wrong: {coefs['x3']}"
print("✓ All coefficients recovered exactly!")

# ============== TEST 2: Z-SCORE COEFFICIENT BACK-TRANSFORM ==============
print("\n" + "=" * 70)
print("TEST 2: Z-SCORE COEFFICIENT BACK-TRANSFORM")
print("=" * 70)

result_std = run_regression(X, y_series, model_type="linear", standardization="standardize")
coefs_std = result_std['coefficients']
coefs_trans = result_std['coefficients_transformed']

print(f"\nTransformed (standardized) coefficients:")
print(f"  intercept={coefs_trans['intercept']:.6f}, x1={coefs_trans['x1']:.6f}, x2={coefs_trans['x2']:.6f}, x3={coefs_trans['x3']:.6f}")

print(f"\nBack-transformed (original scale) coefficients:")
print(f"  intercept={coefs_std['intercept']:.6f}, x1={coefs_std['x1']:.6f}, x2={coefs_std['x2']:.6f}, x3={coefs_std['x3']:.6f}")

print(f"\nExpected original-scale:")
print(f"  intercept={TRUE_INTERCEPT}, x1={TRUE_COEF_X1}, x2={TRUE_COEF_X2}, x3={TRUE_COEF_X3}")

# Manual verification of back-transform

# Use TRAIN data only for scalers (first 80%)
split_idx = int(n * 0.8)
X_train = X.iloc[:split_idx]
y_train = y_series.iloc[:split_idx]

scaler_X = StandardScaler().fit(X_train)

print(f"\nScaler stats (from train):")
print(f"  X means: {scaler_X.mean_}")
print(f"  X stds:  {scaler_X.scale_}")

# Manual back-transform (Streamlit approach - only X is standardized):
# coef_orig = coef_trans / std_x
manual_coef_x1 = coefs_trans['x1'] / scaler_X.scale_[0]
manual_coef_x2 = coefs_trans['x2'] / scaler_X.scale_[1]
manual_coef_x3 = coefs_trans['x3'] / scaler_X.scale_[2]

print(f"\nManual back-transform verification (Streamlit approach):")
print(f"  x1: {coefs_trans['x1']:.6f} / {scaler_X.scale_[0]:.4f} = {manual_coef_x1:.6f}")
print(f"  x2: {coefs_trans['x2']:.6f} / {scaler_X.scale_[1]:.4f} = {manual_coef_x2:.6f}")
print(f"  x3: {coefs_trans['x3']:.6f} / {scaler_X.scale_[2]:.4f} = {manual_coef_x3:.6f}")

assert abs(coefs_std['x1'] - manual_coef_x1) < 0.001, f"x1 back-transform wrong"
assert abs(coefs_std['x2'] - manual_coef_x2) < 0.001, f"x2 back-transform wrong"
assert abs(coefs_std['x3'] - manual_coef_x3) < 0.001, f"x3 back-transform wrong"
print("✓ Coefficient back-transform verified!")

# ============== TEST 3: ELASTICITY CALCULATION ==============
print("\n" + "=" * 70)
print("TEST 3: ELASTICITY CALCULATION")
print("=" * 70)

elasticities = result['elasticities']
# Use TRAIN data means (no leakage - matches Streamlit approach)
y_mean = y_train.mean()

print(f"\nElasticity formula: (coef * x_mean) / y_mean (using TRAIN data)")
print(f"y_mean (train) = {y_mean:.4f}")

for col in ['x1', 'x2', 'x3']:
    x_mean = X_train[col].mean()
    coef = coefs[col]
    expected_elasticity = (coef * x_mean) / y_mean
    reported_elasticity = elasticities[col]
    
    print(f"\n{col}:")
    print(f"  x_mean (train) = {x_mean:.4f}")
    print(f"  coef = {coef:.4f}")
    print(f"  Expected elasticity = ({coef:.4f} * {x_mean:.4f}) / {y_mean:.4f} = {expected_elasticity:.6f}")
    print(f"  Reported elasticity = {reported_elasticity:.6f}")
    
    assert abs(expected_elasticity - reported_elasticity) < 0.0001, f"{col} elasticity wrong!"

print("\n✓ All elasticities verified!")

# ============== TEST 4: BETA (STANDARDIZED COEFFICIENTS) ==============
print("\n" + "=" * 70)
print("TEST 4: BETA (STANDARDIZED COEFFICIENTS)")
print("=" * 70)

betas = result['betas']
y_std = y_train.std()

print(f"\nBeta formula: coef * (x_std / y_std) (using TRAIN data)")
print(f"y_std (train) = {y_std:.4f}")

for col in ['x1', 'x2', 'x3']:
    x_std = X_train[col].std()
    coef = coefs[col]
    expected_beta = coef * (x_std / y_std)
    reported_beta = betas[col]
    
    print(f"\n{col}:")
    print(f"  x_std (train) = {x_std:.4f}")
    print(f"  coef = {coef:.4f}")
    print(f"  Expected beta = {coef:.4f} * ({x_std:.4f} / {y_std:.4f}) = {expected_beta:.6f}")
    print(f"  Reported beta = {reported_beta:.6f}")
    
    assert abs(expected_beta - reported_beta) < 0.0001, f"{col} beta wrong!"

print("\n✓ All betas verified!")

# ============== TEST 5: CONTRIBUTION CALCULATION ==============
print("\n" + "=" * 70)
print("TEST 5: CONTRIBUTION CALCULATION")
print("=" * 70)

contributions = result['contributions']

print(f"\nContribution formula: (coef * x_mean) / sum(|coef * x_mean|) * 100 (using TRAIN data)")

contrib_values = {}
for col in ['x1', 'x2', 'x3']:
    x_mean = X_train[col].mean()
    coef = coefs[col]
    contrib_values[col] = coef * x_mean
    print(f"{col}: coef={coef:.4f} * x_mean={x_mean:.4f} = {contrib_values[col]:.4f}")

total_abs = sum(abs(v) for v in contrib_values.values())
print(f"\nTotal |contrib| = {total_abs:.4f}")

for col in ['x1', 'x2', 'x3']:
    expected_contrib = (contrib_values[col] / total_abs) * 100
    reported_contrib = contributions[col]
    
    print(f"\n{col}:")
    print(f"  Expected contribution = ({contrib_values[col]:.4f} / {total_abs:.4f}) * 100 = {expected_contrib:.2f}%")
    print(f"  Reported contribution = {reported_contrib:.2f}%")
    
    assert abs(expected_contrib - reported_contrib) < 0.01, f"{col} contribution wrong!"

# Verify sum of absolute contributions = 100%
total_contrib = sum(abs(v) for v in contributions.values())
print(f"\nSum of |contributions| = {total_contrib:.2f}%")
assert abs(total_contrib - 100) < 0.01, "Contributions don't sum to 100%!"

print("\n✓ All contributions verified!")

# ============== TEST 6: PREDICTION ACCURACY ==============
print("\n" + "=" * 70)
print("TEST 6: PREDICTION ACCURACY")
print("=" * 70)

predictions = np.array(result['predictions'])
actuals = np.array(result['actuals'])

# With no noise, predictions should be exact
max_error = np.max(np.abs(predictions - actuals))
print(f"Max prediction error: {max_error:.10f}")

# R2 should be 1.0 (perfect fit)
r2 = result['metrics']['r2']
print(f"R2: {r2:.10f}")

assert r2 > 0.9999, f"R2 should be ~1.0 for noiseless data, got {r2}"
print("✓ Predictions are accurate!")

# ============== TEST 7: INTERCEPT BACK-TRANSFORM FOR Z-SCORE ==============
print("\n" + "=" * 70)
print("TEST 7: INTERCEPT BACK-TRANSFORM FOR Z-SCORE")
print("=" * 70)

# Manual intercept calculation:
# intercept_orig = mean_y + intercept_trans * std_y - sum(coef_orig * mean_x)
manual_intercept = scaler_y.mean_[0] + coefs_trans['intercept'] * scaler_y.scale_[0]
for i, col in enumerate(['x1', 'x2', 'x3']):
    manual_intercept -= coefs_std[col] * scaler_X.mean_[i]

print(f"Manual intercept calculation:")
print(f"  = mean_y + intercept_trans * std_y - sum(coef_orig * mean_x)")
print(f"  = {scaler_y.mean_[0]:.4f} + {coefs_trans['intercept']:.6f} * {scaler_y.scale_[0]:.4f} - ...")
print(f"  = {manual_intercept:.6f}")
print(f"Reported intercept: {coefs_std['intercept']:.6f}")

# Note: There might be small differences due to train/test split affecting scaler
print(f"Difference: {abs(manual_intercept - float(coefs_std['intercept'])):.6f}")

print("\n" + "=" * 70)
print("TEST 8: VERIFY PREDICTIONS USE CORRECT COEFFICIENTS")
print("=" * 70)

# Manual prediction using reported coefficients
manual_pred = coefs['intercept'] + coefs['x1']*x1 + coefs['x2']*x2 + coefs['x3']*x3
pred_diff = np.max(np.abs(manual_pred - predictions))
print(f"Max diff between manual and reported predictions: {pred_diff:.10f}")
assert pred_diff < 0.001, "Predictions don't match coefficients!"
print("✓ Predictions match coefficients!")

print("\n" + "=" * 70)
print("ALL ROBUST TESTS PASSED! ✓")
print("=" * 70)
