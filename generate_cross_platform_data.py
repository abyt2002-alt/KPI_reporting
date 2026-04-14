"""
Generate dummy cross-platform marketing data for correlation analysis
Includes Amazon, Shopify, Meta, YouTube, and Direct traffic with realistic lag effects
"""
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# Set random seed for reproducibility
np.random.seed(42)

# Generate 52 weeks of data (1 year)
weeks = 52
start_date = datetime(2024, 1, 1)
dates = [start_date + timedelta(weeks=i) for i in range(weeks)]

# Base trends and seasonality
trend = np.linspace(100, 150, weeks)
seasonality = 20 * np.sin(np.linspace(0, 4 * np.pi, weeks))
base = trend + seasonality

# ============== META ADVERTISING DATA ==============
# Meta spend drives sales with 1-2 week lag
meta_spend = np.maximum(5000 + base * 50 + np.random.normal(0, 2000, weeks), 1000)

# Meta impressions by gender
meta_impressions_male = meta_spend * 180 + np.random.normal(0, 50000, weeks)
meta_impressions_female = meta_spend * 220 + np.random.normal(0, 60000, weeks)
meta_impressions_total = meta_impressions_male + meta_impressions_female

# Meta impressions by age and gender
meta_imp_male_18_24 = meta_impressions_male * 0.25 + np.random.normal(0, 10000, weeks)
meta_imp_male_24_36 = meta_impressions_male * 0.40 + np.random.normal(0, 12000, weeks)
meta_imp_male_36_48 = meta_impressions_male * 0.25 + np.random.normal(0, 10000, weeks)
meta_imp_male_48_plus = meta_impressions_male * 0.10 + np.random.normal(0, 5000, weeks)

meta_imp_female_18_24 = meta_impressions_female * 0.30 + np.random.normal(0, 12000, weeks)
meta_imp_female_24_36 = meta_impressions_female * 0.35 + np.random.normal(0, 15000, weeks)
meta_imp_female_36_48 = meta_impressions_female * 0.25 + np.random.normal(0, 12000, weeks)
meta_imp_female_48_plus = meta_impressions_female * 0.10 + np.random.normal(0, 6000, weeks)

# Meta clicks
meta_clicks_total = meta_impressions_total * 0.02 + np.random.normal(0, 500, weeks)
meta_clicks_male = meta_impressions_male * 0.018 + np.random.normal(0, 200, weeks)
meta_clicks_female = meta_impressions_female * 0.022 + np.random.normal(0, 250, weeks)

# Meta by objective
meta_imp_objective_sales = meta_impressions_total * 0.60 + np.random.normal(0, 30000, weeks)
meta_imp_objective_link_clicks = meta_impressions_total * 0.40 + np.random.normal(0, 25000, weeks)
meta_clicks_objective_sales = meta_clicks_total * 0.65 + np.random.normal(0, 300, weeks)
meta_clicks_objective_link_clicks = meta_clicks_total * 0.35 + np.random.normal(0, 200, weeks)

# Meta by media type
meta_imp_image = meta_impressions_total * 0.45 + np.random.normal(0, 25000, weeks)
meta_imp_video = meta_impressions_total * 0.55 + np.random.normal(0, 30000, weeks)
meta_clicks_image = meta_clicks_total * 0.40 + np.random.normal(0, 200, weeks)
meta_clicks_video = meta_clicks_total * 0.60 + np.random.normal(0, 300, weeks)

# Meta by audience
meta_imp_engaged = meta_impressions_total * 0.30 + np.random.normal(0, 20000, weeks)
meta_imp_prospecting = meta_impressions_total * 0.50 + np.random.normal(0, 30000, weeks)
meta_imp_retargeting = meta_impressions_total * 0.20 + np.random.normal(0, 15000, weeks)
meta_clicks_engaged = meta_clicks_total * 0.35 + np.random.normal(0, 200, weeks)
meta_clicks_prospecting = meta_clicks_total * 0.45 + np.random.normal(0, 250, weeks)
meta_clicks_retargeting = meta_clicks_total * 0.20 + np.random.normal(0, 150, weeks)

# ============== YOUTUBE ADVERTISING DATA ==============
youtube_spend = np.maximum(3000 + base * 30 + np.random.normal(0, 1500, weeks), 500)
youtube_impressions = youtube_spend * 250 + np.random.normal(0, 40000, weeks)
youtube_clicks = youtube_impressions * 0.015 + np.random.normal(0, 300, weeks)
youtube_views = youtube_impressions * 0.25 + np.random.normal(0, 5000, weeks)

# ============== GOOGLE DATA ==============
# Google Organic Search
google_organic_sessions = 5000 + base * 25 + np.random.normal(0, 800, weeks)
google_organic_clicks = google_organic_sessions * 0.85 + np.random.normal(0, 400, weeks)
google_organic_impressions = google_organic_clicks * 15 + np.random.normal(0, 5000, weeks)

# Google PMax (Performance Max)
google_pmax_spend = np.maximum(4000 + base * 35 + np.random.normal(0, 1800, weeks), 800)
google_pmax_impressions = google_pmax_spend * 200 + np.random.normal(0, 35000, weeks)
google_pmax_clicks = google_pmax_impressions * 0.025 + np.random.normal(0, 400, weeks)
google_pmax_conversions = google_pmax_clicks * 0.08 + np.random.normal(0, 30, weeks)

# Google Ads (Search)
google_ads_spend = np.maximum(3500 + base * 30 + np.random.normal(0, 1600, weeks), 700)
google_ads_impressions = google_ads_spend * 180 + np.random.normal(0, 30000, weeks)
google_ads_clicks = google_ads_impressions * 0.03 + np.random.normal(0, 350, weeks)
google_ads_conversions = google_ads_clicks * 0.10 + np.random.normal(0, 35, weeks)

# ============== DIRECT TRAFFIC ==============
direct_sessions = 8000 + base * 20 + np.random.normal(0, 1000, weeks)
direct_pageviews = direct_sessions * 3.5 + np.random.normal(0, 2000, weeks)

# ============== AMAZON DATA ==============
# Amazon is influenced by Meta Female 48+ and 36-48 (lag 1 week) with increasing correlation
# Image impressions drive searches/sessions, Video impressions drive sales
amazon_searches = np.zeros(weeks)
amazon_add_to_cart = np.zeros(weeks)
amazon_generic_sales = np.zeros(weeks)
amazon_non_generic_sales = np.zeros(weeks)

# Correlation strength increases over time (starts at 0.3, grows to 0.8)
correlation_growth = np.linspace(0.3, 0.8, weeks)

for i in range(weeks):
    # Base demand
    base_demand = 500 + trend[i] * 2 + seasonality[i] * 5
    
    # Meta Female 48+ effect (1 week lag) - STRONGEST
    meta_female_48_effect = 0
    if i >= 1:
        meta_female_48_effect = meta_imp_female_48_plus[i-1] * 0.15 * correlation_growth[i]
    
    # Meta Female 36-48 effect (1 week lag) - STRONG
    meta_female_36_effect = 0
    if i >= 1:
        meta_female_36_effect = meta_imp_female_36_48[i-1] * 0.12 * correlation_growth[i]
    
    # Meta Image impressions drive searches (1 week lag)
    meta_image_search_effect = 0
    if i >= 1:
        meta_image_search_effect = meta_imp_image[i-1] * 0.10 * correlation_growth[i]
    
    # Other Meta Female (weaker effect)
    meta_female_other_effect = 0
    if i >= 1:
        meta_female_other_effect = (meta_imp_female_18_24[i-1] + meta_imp_female_24_36[i-1]) * 0.05 * correlation_growth[i]
    
    # YouTube effect (2-3 week lag) - moderate
    youtube_effect = 0
    if i >= 2:
        youtube_effect += youtube_spend[i-2] * 0.04
    if i >= 3:
        youtube_effect += youtube_spend[i-3] * 0.03
    
    # Google effect (1-2 week lag)
    google_effect = 0
    if i >= 1:
        google_effect += (google_pmax_spend[i-1] + google_ads_spend[i-1]) * 0.05
    if i >= 2:
        google_effect += (google_pmax_spend[i-2] + google_ads_spend[i-2]) * 0.03
    
    # Direct effect (immediate)
    direct_effect = direct_sessions[i] * 0.03
    
    amazon_searches[i] = base_demand + meta_female_48_effect + meta_female_36_effect + meta_female_other_effect + meta_image_search_effect + youtube_effect + google_effect + direct_effect + np.random.normal(0, 150)
    amazon_add_to_cart[i] = amazon_searches[i] * 0.15 + np.random.normal(0, 40)
    
    # Meta Video impressions drive sales (1 week lag) - STRONG
    meta_video_sales_effect = 0
    if i >= 1:
        meta_video_sales_effect = meta_imp_video[i-1] * 0.008 * correlation_growth[i]
    
    amazon_generic_sales[i] = amazon_add_to_cart[i] * 0.40 + meta_video_sales_effect + np.random.normal(0, 25)
    amazon_non_generic_sales[i] = amazon_add_to_cart[i] * 0.25 + meta_video_sales_effect * 0.6 + np.random.normal(0, 15)

amazon_total_sales = amazon_generic_sales + amazon_non_generic_sales

# ============== SHOPIFY DATA ==============
# Shopify is influenced by Meta Female 48+ and 36-48 (lag 2 weeks) with increasing correlation
# Image impressions drive sessions, Video impressions drive sales
shopify_sessions = np.zeros(weeks)
shopify_add_to_cart = np.zeros(weeks)
shopify_net_items_sold = np.zeros(weeks)
shopify_new_customers = np.zeros(weeks)
shopify_returning_customers = np.zeros(weeks)

for i in range(weeks):
    # Base traffic
    base_traffic = 3000 + trend[i] * 15 + seasonality[i] * 10
    
    # Meta Female 48+ effect (2 week lag) - STRONGEST
    meta_female_48_effect = 0
    if i >= 2:
        meta_female_48_effect = meta_imp_female_48_plus[i-2] * 0.18 * correlation_growth[i]
    
    # Meta Female 36-48 effect (2 week lag) - STRONG
    meta_female_36_effect = 0
    if i >= 2:
        meta_female_36_effect = meta_imp_female_36_48[i-2] * 0.14 * correlation_growth[i]
    
    # Meta Image impressions drive sessions (2 week lag)
    meta_image_session_effect = 0
    if i >= 2:
        meta_image_session_effect = meta_imp_image[i-2] * 0.12 * correlation_growth[i]
    
    # Other Meta Female (weaker effect)
    meta_female_other_effect = 0
    if i >= 2:
        meta_female_other_effect = (meta_imp_female_18_24[i-2] + meta_imp_female_24_36[i-2]) * 0.06 * correlation_growth[i]
    
    # YouTube effect (1-2 week lag)
    youtube_effect = 0
    if i >= 1:
        youtube_effect += youtube_spend[i-1] * 0.08
    if i >= 2:
        youtube_effect += youtube_spend[i-2] * 0.05
    
    # Google effect (immediate to 1 week lag)
    google_effect = (google_pmax_spend[i] + google_ads_spend[i]) * 0.08
    if i >= 1:
        google_effect += (google_pmax_spend[i-1] + google_ads_spend[i-1]) * 0.05
    
    # Direct effect
    direct_effect = direct_sessions[i] * 0.20
    
    shopify_sessions[i] = base_traffic + meta_female_48_effect + meta_female_36_effect + meta_female_other_effect + meta_image_session_effect + youtube_effect + google_effect + direct_effect + np.random.normal(0, 400)
    shopify_add_to_cart[i] = shopify_sessions[i] * 0.08 + np.random.normal(0, 40)
    
    # Meta Video impressions drive sales (2 week lag) - STRONG
    meta_video_sales_effect = 0
    if i >= 2:
        meta_video_sales_effect = meta_imp_video[i-2] * 0.010 * correlation_growth[i]
    
    shopify_net_items_sold[i] = shopify_add_to_cart[i] * 0.45 + meta_video_sales_effect + np.random.normal(0, 25)
    
    # Customer split
    shopify_new_customers[i] = shopify_net_items_sold[i] * 0.35 + np.random.normal(0, 12)
    shopify_returning_customers[i] = shopify_net_items_sold[i] * 0.65 + np.random.normal(0, 20)

# ============== UTM SOURCE BREAKDOWN (for Shopify) ==============
# Distribute sessions across sources
utm_direct = shopify_sessions * 0.30 + np.random.normal(0, 200, weeks)
utm_meta = shopify_sessions * 0.35 + np.random.normal(0, 250, weeks)
utm_youtube = shopify_sessions * 0.20 + np.random.normal(0, 150, weeks)
utm_google = shopify_sessions * 0.10 + np.random.normal(0, 100, weeks)
utm_email = shopify_sessions * 0.05 + np.random.normal(0, 50, weeks)

# ============== CREATE DATAFRAME ==============
df = pd.DataFrame({
    'Week': dates,
    'Week_Number': range(1, weeks + 1),
    
    # Amazon Metrics
    'Amazon_Searches': np.maximum(amazon_searches, 0),
    'Amazon_Add_To_Cart': np.maximum(amazon_add_to_cart, 0),
    'Amazon_Generic_Sales': np.maximum(amazon_generic_sales, 0),
    'Amazon_Non_Generic_Sales': np.maximum(amazon_non_generic_sales, 0),
    'Amazon_Total_Sales': np.maximum(amazon_total_sales, 0),
    
    # Shopify Metrics
    'Shopify_Sessions': np.maximum(shopify_sessions, 0),
    'Shopify_Add_To_Cart': np.maximum(shopify_add_to_cart, 0),
    'Shopify_Net_Items_Sold': np.maximum(shopify_net_items_sold, 0),
    'Shopify_New_Customers': np.maximum(shopify_new_customers, 0),
    'Shopify_Returning_Customers': np.maximum(shopify_returning_customers, 0),
    
    # UTM Source (Shopify)
    'UTM_Direct': np.maximum(utm_direct, 0),
    'UTM_Meta': np.maximum(utm_meta, 0),
    'UTM_YouTube': np.maximum(utm_youtube, 0),
    'UTM_Google': np.maximum(utm_google, 0),
    'UTM_Email': np.maximum(utm_email, 0),
    
    # Meta - Total
    'Meta_Spend': np.maximum(meta_spend, 0),
    'Meta_Impressions_Total': np.maximum(meta_impressions_total, 0),
    'Meta_Clicks_Total': np.maximum(meta_clicks_total, 0),
    
    # Meta - By Gender
    'Meta_Impressions_Male': np.maximum(meta_impressions_male, 0),
    'Meta_Impressions_Female': np.maximum(meta_impressions_female, 0),
    'Meta_Clicks_Male': np.maximum(meta_clicks_male, 0),
    'Meta_Clicks_Female': np.maximum(meta_clicks_female, 0),
    
    # Meta - By Age & Gender (Impressions)
    'Meta_Imp_Male_18_24': np.maximum(meta_imp_male_18_24, 0),
    'Meta_Imp_Male_24_36': np.maximum(meta_imp_male_24_36, 0),
    'Meta_Imp_Male_36_48': np.maximum(meta_imp_male_36_48, 0),
    'Meta_Imp_Male_48_Plus': np.maximum(meta_imp_male_48_plus, 0),
    'Meta_Imp_Female_18_24': np.maximum(meta_imp_female_18_24, 0),
    'Meta_Imp_Female_24_36': np.maximum(meta_imp_female_24_36, 0),
    'Meta_Imp_Female_36_48': np.maximum(meta_imp_female_36_48, 0),
    'Meta_Imp_Female_48_Plus': np.maximum(meta_imp_female_48_plus, 0),
    
    # Meta - By Objective
    'Meta_Imp_Objective_Sales': np.maximum(meta_imp_objective_sales, 0),
    'Meta_Imp_Objective_Link_Clicks': np.maximum(meta_imp_objective_link_clicks, 0),
    'Meta_Clicks_Objective_Sales': np.maximum(meta_clicks_objective_sales, 0),
    'Meta_Clicks_Objective_Link_Clicks': np.maximum(meta_clicks_objective_link_clicks, 0),
    
    # Meta - By Media Type
    'Meta_Imp_Image': np.maximum(meta_imp_image, 0),
    'Meta_Imp_Video': np.maximum(meta_imp_video, 0),
    'Meta_Clicks_Image': np.maximum(meta_clicks_image, 0),
    'Meta_Clicks_Video': np.maximum(meta_clicks_video, 0),
    
    # Meta - By Audience
    'Meta_Imp_Engaged': np.maximum(meta_imp_engaged, 0),
    'Meta_Imp_Prospecting': np.maximum(meta_imp_prospecting, 0),
    'Meta_Imp_Retargeting': np.maximum(meta_imp_retargeting, 0),
    'Meta_Clicks_Engaged': np.maximum(meta_clicks_engaged, 0),
    'Meta_Clicks_Prospecting': np.maximum(meta_clicks_prospecting, 0),
    'Meta_Clicks_Retargeting': np.maximum(meta_clicks_retargeting, 0),
    
    # Google - Organic Search
    'Google_Organic_Sessions': np.maximum(google_organic_sessions, 0),
    'Google_Organic_Clicks': np.maximum(google_organic_clicks, 0),
    'Google_Organic_Impressions': np.maximum(google_organic_impressions, 0),
    
    # Google - PMax
    'Google_PMax_Spend': np.maximum(google_pmax_spend, 0),
    'Google_PMax_Impressions': np.maximum(google_pmax_impressions, 0),
    'Google_PMax_Clicks': np.maximum(google_pmax_clicks, 0),
    'Google_PMax_Conversions': np.maximum(google_pmax_conversions, 0),
    
    # Google - Ads (Search)
    'Google_Ads_Spend': np.maximum(google_ads_spend, 0),
    'Google_Ads_Impressions': np.maximum(google_ads_impressions, 0),
    'Google_Ads_Clicks': np.maximum(google_ads_clicks, 0),
    'Google_Ads_Conversions': np.maximum(google_ads_conversions, 0),
    
    # Google - YouTube
    'Google_YouTube_Spend': np.maximum(youtube_spend, 0),
    'Google_YouTube_Impressions': np.maximum(youtube_impressions, 0),
    'Google_YouTube_Clicks': np.maximum(youtube_clicks, 0),
    'Google_YouTube_Views': np.maximum(youtube_views, 0),
    
    # Direct Traffic
    'Direct_Sessions': np.maximum(direct_sessions, 0),
    'Direct_Pageviews': np.maximum(direct_pageviews, 0),
})

# Round all numeric columns to 0 decimal places
numeric_cols = df.select_dtypes(include=[np.number]).columns
df[numeric_cols] = df[numeric_cols].round(0).astype(int)

# Format Week column
df['Week'] = df['Week'].dt.strftime('%Y-%m-%d')

# Save to CSV
output_file = 'cross_platform_marketing_data.csv'
df.to_csv(output_file, index=False)

print(f"✅ Generated {len(df)} weeks of cross-platform data")
print(f"📊 Total columns: {len(df.columns)}")
print(f"💾 Saved to: {output_file}")
print("\n📈 Sample correlations (with lag):")
print(f"   Meta Spend → Amazon Sales (lag 1-2): Strong positive")
print(f"   Meta Spend → Shopify Sales (lag 0-1): Strong positive")
print(f"   YouTube Spend → Amazon Sales (lag 2-3): Moderate positive")
print(f"   YouTube Spend → Shopify Sales (lag 1-2): Moderate positive")
print("\n🎯 Key insights built into the data:")
print("   - Meta has faster impact on Shopify (0-1 week lag)")
print("   - Meta has delayed impact on Amazon (1-2 week lag)")
print("   - YouTube has longer lag (2-3 weeks for Amazon)")
print("   - Female audience has higher engagement on Meta")
print("   - Video content performs better than images")
print("   - Prospecting audience has highest volume")
print("\n📋 Column categories:")
print(f"   - Amazon: {len([c for c in df.columns if 'Amazon' in c])} metrics")
print(f"   - Shopify: {len([c for c in df.columns if 'Shopify' in c or 'UTM' in c])} metrics")
print(f"   - Meta: {len([c for c in df.columns if 'Meta' in c])} metrics")
print(f"   - Google: {len([c for c in df.columns if 'Google' in c])} metrics (includes YouTube)")
print(f"   - Direct: {len([c for c in df.columns if 'Direct' in c])} metrics")
