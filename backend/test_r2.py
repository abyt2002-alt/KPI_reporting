"""
Test R2 calculation specifically
"""
import numpy as np
import pandas as pd
from sklearn.metrics import r2_score
from sklearn.linear_model import LinearRegression
from models.regression import run_regression

np.random.seed(42)

# Create data with some noise (realistic scenario)
n = 100
x1 = np.random.uniform(10, 50, n)
x2 = np.random.uniform(100, 500, n)
noise = np.random.normal(0, 10, n)  # Add noise

y = 5 + 3*x1 + 0.2*x2 + noise

X = pd.DataFrame({'x1': x1, 'x2': x2})
y_series = pd.Series(y)

print("=" * 60)
print("TEST: R2 Calculation Verification")
print("=" * 60)

# Test 1: No standardization
print("\n--- No Standardization ---")
result = run_regression(X, y_series, model_type="linear", standardization="none")

# Manual R2 on full data
y_actual = np.array(result['actuals'])
y_pred = np.array(result['predictions'])
manual_r2 = r2_score(y_actual, y_pred)

print(f"Reported R2: {result['metrics']['r2']:.6f}")
print(f"Manual R2:   {manual_r2:.6f}")
print(f"Match: {abs(result['metrics']['r2'] - manual_r2) < 0.0001}")

# Verify with sklearn directly on same data
# Note: Our function uses sequential split, so we need to match that
split_idx = int(n * 0.8)
X_train_check = X.iloc[:split_idx]
y_train_check = y_series.iloc[:split_idx]

model_check = LinearRegression()
model_check.fit(X_train_check, y_train_check)
y_pred_check = model_check.predict(X)
sklearn_r2 = r2_score(y_series, y_pred_check)

print(f"Sklearn R2 (same split): {sklearn_r2:.6f}")

# Test 2: With Z-Score standardization
print("\n--- Z-Score Standardization ---")
result_std = run_regression(X, y_series, model_type="linear", standardization="standardize")

y_actual_std = np.array(result_std['actuals'])
y_pred_std = np.array(result_std['predictions'])
manual_r2_std = r2_score(y_actual_std, y_pred_std)

print(f"Reported R2: {result_std['metrics']['r2']:.6f}")
print(f"Manual R2:   {manual_r2_std:.6f}")
print(f"Match: {abs(result_std['metrics']['r2'] - manual_r2_std) < 0.0001}")

# Both should give same R2 (standardization shouldn't change R2)
print(f"\nR2 no-std vs R2 std: {result['metrics']['r2']:.6f} vs {result_std['metrics']['r2']:.6f}")
print(f"Should be similar (within noise): {abs(result['metrics']['r2'] - result_std['metrics']['r2']) < 0.01}")

# Test 3: Check predictions are on original scale
print("\n--- Scale Check ---")
print(f"y original mean: {y_series.mean():.2f}")
print(f"Predictions mean (no std): {np.mean(result['predictions']):.2f}")
print(f"Predictions mean (z-score): {np.mean(result_std['predictions']):.2f}")
print(f"Actuals mean: {np.mean(result['actuals']):.2f}")

# Test 4: R2 test (holdout)
print("\n--- R2 Test (Holdout) ---")
print(f"R2 test (no std): {result['metrics']['r2_test']:.6f}")
print(f"R2 test (z-score): {result_std['metrics']['r2_test']:.6f}")

# Manual verification of R2 test
y_test_actual = y_series.iloc[split_idx:].values
y_test_pred = np.array(result['predictions'])[split_idx:]
# Wait - predictions are for full data, need to check indices

print("\n--- Debug: Data lengths ---")
print(f"Full data length: {len(y_series)}")
print(f"Predictions length: {len(result['predictions'])}")
print(f"Actuals length: {len(result['actuals'])}")

print("\n" + "=" * 60)
print("If R2 looks wrong in UI, check:")
print("1. Are predictions and actuals same length?")
print("2. Is the chart showing correct data?")
print("3. Is there data filtering happening?")
print("=" * 60)
