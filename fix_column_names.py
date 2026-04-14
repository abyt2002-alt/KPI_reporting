"""
Fix column names to have proper platform prefixes
"""
import pandas as pd

# Read the CSV with proper encoding
df = pd.read_csv('sampledata/combined_all_weekly.csv', encoding='latin1')

print("Original columns:", len(df.columns))

# Create a mapping of old names to new names
rename_map = {}

for col in df.columns:
    # Skip columns that are already properly named or are metadata
    if col in ['Week', 'Week_Start', 'Week_End', 'avg_session_duration']:
        continue
    
    # Amazon columns - already have prefix
    if col.startswith('Amazon'):
        continue
    
    # Google columns - already have prefix
    if col.startswith('Google_'):
        continue
    
    # Shopify columns
    if col.startswith('Shopify') or col in ['Net items sold', 'Quantity ordered', 'Sessions_With_Cart_Additions']:
        if not col.startswith('Shopify_'):
            new_name = 'Shopify_' + col.replace('Shopify ', '').replace(' ', '_')
            rename_map[col] = new_name
        continue
    
    # Meta columns - everything else with Impressions/ThruPlays
    if 'Impressions' in col or 'ThruPlays' in col or col in ['Meta Impressions', 'Meta ThruPlays']:
        if not col.startswith('Meta_'):
            # Handle special cases
            if col == 'Meta Impressions':
                rename_map[col] = 'Meta_Total_Impressions'
            elif col == 'Meta ThruPlays':
                rename_map[col] = 'Meta_Total_ThruPlays'
            else:
                new_name = 'Meta_' + col
                rename_map[col] = new_name

# Apply the renaming
df.rename(columns=rename_map, inplace=True)

# Save the updated CSV
df.to_csv('sampledata/combined_all_weekly.csv', index=False)

print(f"\n✅ Renamed {len(rename_map)} columns")
print(f"📊 Total columns: {len(df.columns)}")
print("\n📋 Sample renamed columns:")
for old, new in list(rename_map.items())[:10]:
    print(f"   {old} → {new}")

# Show column breakdown by platform
meta_cols = [c for c in df.columns if c.startswith('Meta_')]
amazon_cols = [c for c in df.columns if c.startswith('Amazon')]
shopify_cols = [c for c in df.columns if c.startswith('Shopify_')]
google_cols = [c for c in df.columns if c.startswith('Google_')]

print(f"\n📊 Columns by platform:")
print(f"   Meta: {len(meta_cols)} columns")
print(f"   Amazon: {len(amazon_cols)} columns")
print(f"   Shopify: {len(shopify_cols)} columns")
print(f"   Google: {len(google_cols)} columns")
