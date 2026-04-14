"""
Add Google metrics columns to the sample data
"""
import pandas as pd
import numpy as np

# Read the existing CSV with proper encoding
df = pd.read_csv('sampledata/combined_all_weekly.csv', encoding='latin1')

# Set random seed for reproducibility
np.random.seed(42)

weeks = len(df)

# Generate Google metrics based on existing Meta data patterns
# Use Meta Impressions as a base to create correlated Google data

meta_impressions = df['Meta Impressions'].values

# Google Organic Search (SEO traffic - steady growth)
google_organic_sessions = np.maximum(
    5000 + np.linspace(0, 3000, weeks) + np.random.normal(0, 800, weeks),
    1000
).astype(int)

google_organic_clicks = (google_organic_sessions * 0.85 + np.random.normal(0, 400, weeks)).astype(int)
google_organic_impressions = (google_organic_clicks * 15 + np.random.normal(0, 5000, weeks)).astype(int)

# Google PMax (Performance Max - correlated with Meta spend)
google_pmax_impressions = (meta_impressions * 0.3 + np.random.normal(0, 35000, weeks)).astype(int)
google_pmax_clicks = (google_pmax_impressions * 0.025 + np.random.normal(0, 400, weeks)).astype(int)
google_pmax_conversions = np.maximum(
    (google_pmax_clicks * 0.08 + np.random.normal(0, 30, weeks)),
    0
).astype(int)

# Google Ads (Search Ads - similar to PMax but slightly different)
google_ads_impressions = (meta_impressions * 0.25 + np.random.normal(0, 30000, weeks)).astype(int)
google_ads_clicks = (google_ads_impressions * 0.03 + np.random.normal(0, 350, weeks)).astype(int)
google_ads_conversions = np.maximum(
    (google_ads_clicks * 0.10 + np.random.normal(0, 35, weeks)),
    0
).astype(int)

# Google YouTube (Video advertising - correlated with Meta Video)
google_youtube_impressions = (meta_impressions * 0.35 + np.random.normal(0, 40000, weeks)).astype(int)
google_youtube_clicks = (google_youtube_impressions * 0.015 + np.random.normal(0, 300, weeks)).astype(int)
google_youtube_views = (google_youtube_impressions * 0.25 + np.random.normal(0, 5000, weeks)).astype(int)

# Add new columns to dataframe
df['Google_Organic_Sessions'] = google_organic_sessions
df['Google_Organic_Clicks'] = google_organic_clicks
df['Google_Organic_Impressions'] = google_organic_impressions

df['Google_PMax_Impressions'] = google_pmax_impressions
df['Google_PMax_Clicks'] = google_pmax_clicks
df['Google_PMax_Conversions'] = google_pmax_conversions

df['Google_Ads_Impressions'] = google_ads_impressions
df['Google_Ads_Clicks'] = google_ads_clicks
df['Google_Ads_Conversions'] = google_ads_conversions

df['Google_YouTube_Impressions'] = google_youtube_impressions
df['Google_YouTube_Clicks'] = google_youtube_clicks
df['Google_YouTube_Views'] = google_youtube_views

# Save updated CSV
df.to_csv('sampledata/combined_all_weekly.csv', index=False)

print(f"✅ Added Google metrics to {len(df)} weeks of data")
print(f"📊 Total columns now: {len(df.columns)}")
print("\n📋 New Google columns added:")
print("   - Google_Organic_Sessions, Google_Organic_Clicks, Google_Organic_Impressions")
print("   - Google_PMax_Impressions, Google_PMax_Clicks, Google_PMax_Conversions")
print("   - Google_Ads_Impressions, Google_Ads_Clicks, Google_Ads_Conversions")
print("   - Google_YouTube_Impressions, Google_YouTube_Clicks, Google_YouTube_Views")
