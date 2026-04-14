"""
Fix encoding issues in column names
"""
import pandas as pd

# Read the CSV with latin1 encoding
df = pd.read_csv('sampledata/combined_all_weekly.csv', encoding='latin1')

print("Before fix:")
shopify_cols = [c for c in df.columns if 'Shopify' in c]
for col in shopify_cols:
    print(f"  {repr(col)}")

# Fix the problematic column name
rename_map = {}
for col in df.columns:
    # Remove any non-ASCII characters and fix the Shopify column
    if 'Shopify' in col and 'Homepage' in col:
        rename_map[col] = 'Shopify_Homepage_Direct_Traffic'
    # Clean any other columns with encoding issues
    elif any(ord(char) > 127 for char in col):
        # Remove non-ASCII characters
        clean_name = ''.join(char for char in col if ord(char) < 128)
        rename_map[col] = clean_name

if rename_map:
    df.rename(columns=rename_map, inplace=True)
    print(f"\n✅ Fixed {len(rename_map)} column names")
    for old, new in rename_map.items():
        print(f"  {repr(old)} → {repr(new)}")
else:
    print("\n✅ No encoding issues found")

print("\nAfter fix:")
shopify_cols = [c for c in df.columns if 'Shopify' in c]
for col in shopify_cols:
    print(f"  {col}")

# Save the fixed CSV
df.to_csv('sampledata/combined_all_weekly.csv', index=False, encoding='utf-8')
print(f"\n💾 Saved fixed CSV with {len(df.columns)} columns")
