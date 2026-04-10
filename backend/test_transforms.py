"""Test transforms module"""
import numpy as np
import pandas as pd
import sys
sys.path.insert(0, '.')
from models.transforms import (
    geometric_adstock_series, 
    apply_geometric_adstock, 
    apply_logistic_transform, 
    rescale_betas_to_original,
    get_long_run_multiplier
)

# Test 1: Geometric Adstock
print('=== Test 1: Geometric Adstock ===')
values = np.array([100, 0, 0, 0, 0])
decay = 0.5
result = geometric_adstock_series(values, decay)
print(f'Input: {values}')
print(f'Decay: {decay}')
print(f'Adstocked: {result}')
# Expected: [100, 50, 25, 12.5, 6.25]
expected = [100, 50, 25, 12.5, 6.25]
print(f'Expected: {expected}')
assert np.allclose(result, expected), "Adstock formula mismatch!"
print('PASS')

# Test 2: Apply adstock to DataFrame
print('\n=== Test 2: Apply Adstock to DataFrame ===')
df = pd.DataFrame({'spend': [100, 50, 0, 0, 200], 'other': [1, 2, 3, 4, 5]})
df_transformed, decays = apply_geometric_adstock(df, columns=['spend'], decay=0.5)
print(f'Original spend: {list(df["spend"])}')
print(f'Transformed spend: {list(df_transformed["spend"])}')
print(f'Chosen decays: {decays}')
assert decays['spend'] == 0.5
print('PASS')

# Test 3: Logistic Transform
print('\n=== Test 3: Logistic Transform ===')
df = pd.DataFrame({'x': [0, 25, 50, 75, 100]})
df_transformed, metadata = apply_logistic_transform(df, columns=['x'], steepness=1.0)
print(f'Original x: {list(df["x"])}')
print(f'Transformed x: {[round(v, 4) for v in df_transformed["x"]]}')
print(f'Metadata: median={metadata["x"]["median"]}, scale={metadata["x"]["scale"]}, k={metadata["x"]["steepness"]}')
# At median (50), logistic should be 0.5
assert abs(df_transformed.loc[2, 'x'] - 0.5) < 0.01, "Logistic at median should be ~0.5"
print('PASS')

# Test 4: Long-run multiplier
print('\n=== Test 4: Long-run Multiplier ===')
for decay in [0.0, 0.3, 0.5, 0.7, 0.9]:
    mult = get_long_run_multiplier(decay)
    print(f'Decay {decay} -> Multiplier {mult:.2f}')
assert get_long_run_multiplier(0.5) == 2.0
assert get_long_run_multiplier(0.0) == 1.0
print('PASS')

# Test 5: Rescale betas with adstock
print('\n=== Test 5: Rescale Betas with Adstock ===')
betas = np.array([[0.0, 1.0, 2.0]])  # Intercept, feature1, feature2
feature_names = ['Intercept', 'feature1', 'feature2']
adstock_map = {'feature1': 0.5}  # decay=0.5 -> multiplier=2.0
betas_rescaled = rescale_betas_to_original(
    betas=betas,
    scaler_means=None,
    scaler_scales=None,
    feature_names=feature_names,
    adstock_map=adstock_map,
    scurve_map=None
)
print(f'Original betas: {betas}')
print(f'Rescaled betas: {betas_rescaled}')
# feature1 should be multiplied by 2.0 (long-run multiplier)
assert betas_rescaled[0, 1] == 2.0, f"Expected 2.0, got {betas_rescaled[0, 1]}"
assert betas_rescaled[0, 2] == 2.0, "feature2 should be unchanged"
print('PASS')

print('\n=== All tests passed! ===')
