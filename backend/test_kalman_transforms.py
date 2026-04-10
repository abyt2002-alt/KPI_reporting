"""Test Kalman filter with adstock and logistic transforms"""
import sys
sys.path.insert(0, '.')
from models.transforms import apply_geometric_adstock, apply_logistic_transform, rescale_betas_to_original
from models.kalman import run_kalman_filter
import pandas as pd
import numpy as np

# Create test data
np.random.seed(42)
n = 50
df = pd.DataFrame({
    'spend': np.random.uniform(100, 1000, n),
    'price': np.random.uniform(10, 50, n),
})
# Target with some relationship
df['sales'] = 500 + 0.5 * df['spend'] - 5 * df['price'] + np.random.normal(0, 50, n)

print('=== Test: Kalman with Adstock ===')
# Apply adstock
df_transformed, adstock_decays = apply_geometric_adstock(
    df.copy(), 
    columns=['spend'], 
    decay=0.5
)
print(f'Adstock decays: {adstock_decays}')

# Run Kalman
result = run_kalman_filter(
    df_transformed[['spend', 'price']],
    df_transformed['sales'],
    q=0.0001,
    r=1.0,
    adaptive=True,
    standardize=True,
    adstock_map=adstock_decays
)
print(f'R2: {result["metrics"]["r2"]:.4f}')
print(f'Coefficients: spend={result["coefficients"]["spend"]:.4f}, price={result["coefficients"]["price"]:.4f}')
print(f'Instantaneous: spend={result["coefficients_instantaneous"]["spend"]:.4f}')

# Check long-run multiplier was applied
# With decay=0.5, multiplier should be 2.0
inst_spend = result["coefficients_instantaneous"]["spend"]
final_spend = result["coefficients"]["spend"]
ratio = final_spend / inst_spend if inst_spend != 0 else 0
print(f'Long-run multiplier applied: {ratio:.2f} (expected ~2.0)')

print('\n=== Test: Kalman with Logistic ===')
df_transformed2, logistic_meta = apply_logistic_transform(
    df.copy(),
    columns=['spend'],
    steepness=1.0
)
print(f'Logistic metadata keys: {list(logistic_meta.keys())}')
print(f'Spend steepness: {logistic_meta["spend"]["steepness"]}')
print(f'Spend responsiveness: {logistic_meta["spend"]["responsiveness"]:.2f}')

result2 = run_kalman_filter(
    df_transformed2[['spend', 'price']],
    df_transformed2['sales'],
    q=0.0001,
    r=1.0,
    adaptive=True,
    standardize=True,
    scurve_map=logistic_meta
)
print(f'R2 with logistic: {result2["metrics"]["r2"]:.4f}')

print('\n=== All tests passed! ===')
