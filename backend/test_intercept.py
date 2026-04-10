"""
Test intercept calculation specifically
"""
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LinearRegression
from models.regression import run_regression

np.random.seed(42)

# Create data with known intercept
n = 100
x1 = np.random.uniform(10, 50, n)
x2 = np.random.uniform(100, 500, n)

# TRUE: y = 50 + 2*x1 + 0.3*x2
TRUE_INTERCEPT = 50
TRUE_COEF_X1 = 2
TRUE_COEF_X2 = 0.3

y = TRUE_INTERCEPT + TRUE_COEF_X1*x1 + TRUE_COEF_X2*x2

X = pd.DataFrame({'x1': x1, 'x2': x2})
y_series = pd.Series(y)

print("=" * 60)
print("TRUE MODEL: y = 50 + 2*x1 + 0.3*x2")
print("=" * 60)

# Test 1: No standardization
print("\n--- No Standardization ---")
result = run_regression(X, y_series, model_type="linear", standardization="none")
print(f"Intercept: {result['coefficients']['intercept']:.6f} (expected: 50)")
print(f"x1 coef: {result['coefficients']['x1']:.6f} (expected: 2)")
print(f"x2 coef: {result['coefficients']['x2']:.6f} (expected: 0.3)")

# Verify prediction using coefficients
sample_x1, sample_x2 = 30, 300
expected_y = TRUE_INTERCEPT + TRUE_COEF_X1*sample_x1 + TRUE_COEF_X2*sample_x2
predicted_y = result['coefficients']['intercept'] + result['coefficients']['x1']*sample_x1 + result['coefficients']['x2']*sample_x2
print(f"\nPrediction check (x1=30, x2=300):")
print(f"  Expected: {expected_y}")
print(f"  Using reported coefs: {predicted_y:.6f}")
print(f"  Match: {abs(expected_y - predicted_y) < 0.001}")

# Test 2: Z-Score standardization
print("\n--- Z-Score Standardization ---")
result_std = run_regression(X, y_series, model_type="linear", standardization="standardize")
print(f"Intercept: {result_std['coefficients']['intercept']:.6f} (expected: 50)")
print(f"x1 coef: {result_std['coefficients']['x1']:.6f} (expected: 2)")
print(f"x2 coef: {result_std['coefficients']['x2']:.6f} (expected: 0.3)")

# Verify prediction using back-transformed coefficients
predicted_y_std = result_std['coefficients']['intercept'] + result_std['coefficients']['x1']*sample_x1 + result_std['coefficients']['x2']*sample_x2
print(f"\nPrediction check (x1=30, x2=300):")
print(f"  Expected: {expected_y}")
print(f"  Using reported coefs: {predicted_y_std:.6f}")
print(f"  Match: {abs(expected_y - predicted_y_std) < 0.001}")

# Manual verification of intercept back-transform
print("\n--- Manual Intercept Verification ---")

# Sequential split (first 80%)
split_idx = int(n * 0.8)
X_train = X.iloc[:split_idx]
y_train = y_series.iloc[:split_idx]

scaler_X = StandardScaler().fit(X_train)
scaler_y = StandardScaler().fit(y_train.values.reshape(-1, 1))

print(f"Scaler X means: {scaler_X.mean_}")
print(f"Scaler X stds: {scaler_X.scale_}")
print(f"Scaler y mean: {scaler_y.mean_[0]:.4f}")
print(f"Scaler y std: {scaler_y.scale_[0]:.4f}")

# Get transformed coefficients
trans_coefs = result_std['coefficients_transformed']
print(f"\nTransformed intercept: {trans_coefs['intercept']:.6f}")
print(f"Transformed x1: {trans_coefs['x1']:.6f}")
print(f"Transformed x2: {trans_coefs['x2']:.6f}")

# Manual back-transform of intercept:
# intercept_orig = mean_y + intercept_trans * std_y - sum(coef_orig * mean_x)
coef_x1_orig = trans_coefs['x1'] * scaler_y.scale_[0] / scaler_X.scale_[0]
coef_x2_orig = trans_coefs['x2'] * scaler_y.scale_[0] / scaler_X.scale_[1]

intercept_manual = scaler_y.mean_[0] + trans_coefs['intercept'] * scaler_y.scale_[0]
intercept_manual -= coef_x1_orig * scaler_X.mean_[0]
intercept_manual -= coef_x2_orig * scaler_X.mean_[1]

print(f"\nManual intercept calculation:")
print(f"  = mean_y + intercept_trans * std_y - sum(coef_orig * mean_x)")
print(f"  = {scaler_y.mean_[0]:.4f} + {trans_coefs['intercept']:.6f} * {scaler_y.scale_[0]:.4f}")
print(f"    - {coef_x1_orig:.6f} * {scaler_X.mean_[0]:.4f}")
print(f"    - {coef_x2_orig:.6f} * {scaler_X.mean_[1]:.4f}")
print(f"  = {intercept_manual:.6f}")
print(f"Reported intercept: {result_std['coefficients']['intercept']:.6f}")
print(f"Match: {abs(intercept_manual - float(result_std['coefficients']['intercept'])) < 0.01}")

# Final verification: use sklearn directly
print("\n--- Sklearn Direct Comparison ---")
X_train_scaled = scaler_X.transform(X_train)
y_train_scaled = scaler_y.transform(y_train.values.reshape(-1, 1)).flatten()

model = LinearRegression()
model.fit(X_train_scaled, y_train_scaled)

print(f"Sklearn transformed intercept: {model.intercept_:.6f}")
print(f"Our transformed intercept: {trans_coefs['intercept']:.6f}")

# Predict on original scale
X_full_scaled = scaler_X.transform(X)
y_pred_scaled = model.predict(X_full_scaled)
y_pred_orig = scaler_y.inverse_transform(y_pred_scaled.reshape(-1, 1)).flatten()

# Check if predictions match
our_preds = np.array(result_std['predictions'])
sklearn_preds = y_pred_orig

print(f"\nPrediction comparison:")
print(f"Max diff: {np.max(np.abs(our_preds - sklearn_preds)):.10f}")
print(f"Match: {np.max(np.abs(our_preds - sklearn_preds)) < 0.001}")
