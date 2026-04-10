"""Test Kalman Filter"""
import numpy as np
import pandas as pd
from models.kalman import run_kalman_filter

np.random.seed(42)

# Create test data
n = 100
x1 = np.random.uniform(10, 50, n)
x2 = np.random.uniform(100, 500, n)
noise = np.random.normal(0, 5, n)
y = 10 + 2*x1 + 0.3*x2 + noise

X = pd.DataFrame({'x1': x1, 'x2': x2})
y_series = pd.Series(y)

print("=" * 60)
print("TEST 1: Kalman Filter without constraints")
print("=" * 60)
result = run_kalman_filter(X, y_series, q=0.0001, r=1.0, adaptive=True, standardize=True)

print(f"\nMetrics:")
for k, v in result['metrics'].items():
    print(f"  {k}: {v:.4f}")

print(f"\nFinal Coefficients:")
for k, v in result['coefficients'].items():
    print(f"  {k}: {v:.4f}")

print("\n" + "=" * 60)
print("TEST 2: Kalman Filter with constraints (x1 >= 0, x2 >= 0)")
print("=" * 60)
result_constrained = run_kalman_filter(
    X, y_series, 
    q=0.0001, r=1.0, 
    adaptive=True, 
    standardize=True,
    non_negative_features=['x1', 'x2']
)

print(f"\nMetrics:")
for k, v in result_constrained['metrics'].items():
    print(f"  {k}: {v:.4f}")

print(f"\nFinal Coefficients (should be >= 0 for x1, x2):")
for k, v in result_constrained['coefficients'].items():
    sign = "✓" if k == "Intercept" or v >= 0 else "✗"
    print(f"  {k}: {v:.4f} {sign}")

# Test with negative constraint
print("\n" + "=" * 60)
print("TEST 3: Kalman Filter with negative constraint (x1 <= 0)")
print("=" * 60)

# Create data where x1 should have negative effect
y_neg = 100 - 2*x1 + 0.3*x2 + noise

result_neg = run_kalman_filter(
    X, pd.Series(y_neg), 
    q=0.0001, r=1.0, 
    adaptive=True, 
    standardize=True,
    non_positive_features=['x1']
)

print(f"\nFinal Coefficients (x1 should be <= 0):")
for k, v in result_neg['coefficients'].items():
    if k == 'x1':
        sign = "✓" if v <= 0 else "✗"
    else:
        sign = ""
    print(f"  {k}: {v:.4f} {sign}")

print("\n✓ All Kalman Filter tests completed!")
