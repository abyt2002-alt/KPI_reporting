# Cross-Platform Marketing Dataset

## Overview
This dataset contains 52 weeks of synthetic marketing and sales data across multiple platforms (Amazon, Shopify, Meta, YouTube, and Direct traffic). The data is designed to demonstrate cross-platform correlation analysis with realistic lag effects.

## File Information
- **Filename**: `cross_platform_marketing_data.csv`
- **Rows**: 52 (weekly data for 1 year)
- **Columns**: 52 metrics
- **Date Range**: 2024-01-01 to 2024-12-23

## Built-in Correlations & Lag Effects

### Meta Advertising Impact
- **Shopify Sales**: Immediate to 1-week lag (strong correlation)
- **Amazon Sales**: 1-2 week lag (strong correlation)
- **Female audience**: Higher engagement and conversion
- **Video content**: Better performance than images
- **Prospecting audience**: Highest volume

### YouTube Advertising Impact
- **Amazon Sales**: 2-3 week lag (moderate correlation)
- **Shopify Sales**: 1-2 week lag (moderate correlation)

### Direct Traffic
- Immediate impact on both platforms
- Baseline traffic with seasonal trends

## Column Definitions

### Time Columns (2)
- `Week`: Date in YYYY-MM-DD format
- `Week_Number`: Sequential week number (1-52)

### Amazon Metrics (5)
| Column | Description |
|--------|-------------|
| `Amazon_Searches` | Number of product searches on Amazon |
| `Amazon_Add_To_Cart` | Items added to cart |
| `Amazon_Generic_Sales` | Sales from generic/branded keywords |
| `Amazon_Non_Generic_Sales` | Sales from non-branded keywords |
| `Amazon_Total_Sales` | Total sales (generic + non-generic) |

**Key Insights**:
- Influenced by Meta (1-2 week lag)
- Influenced by YouTube (2-3 week lag)
- Generic sales typically higher than non-generic

### Shopify Metrics (10)
| Column | Description |
|--------|-------------|
| `Shopify_Sessions` | Website sessions |
| `Shopify_Add_To_Cart` | Items added to cart |
| `Shopify_Net_Items_Sold` | Total items sold |
| `Shopify_New_Customers` | First-time buyers |
| `Shopify_Returning_Customers` | Repeat buyers |
| `UTM_Direct` | Sessions from direct traffic |
| `UTM_Meta` | Sessions from Meta ads |
| `UTM_YouTube` | Sessions from YouTube ads |
| `UTM_Google` | Sessions from Google ads |
| `UTM_Email` | Sessions from email campaigns |

**Key Insights**:
- Influenced by Meta (immediate to 1-week lag)
- Influenced by YouTube (1-2 week lag)
- Returning customers ~65% of sales
- Meta is largest traffic source (~35%)

### Meta Advertising Metrics (30)

#### Overall Metrics (3)
- `Meta_Spend`: Total ad spend ($)
- `Meta_Impressions_Total`: Total impressions
- `Meta_Clicks_Total`: Total clicks

#### By Gender (4)
- `Meta_Impressions_Male`: Impressions to male audience
- `Meta_Impressions_Female`: Impressions to female audience
- `Meta_Clicks_Male`: Clicks from male audience
- `Meta_Clicks_Female`: Clicks from female audience

#### By Age & Gender - Impressions (8)
- `Meta_Imp_Male_18_24`: Males aged 18-24
- `Meta_Imp_Male_24_36`: Males aged 24-36
- `Meta_Imp_Male_36_48`: Males aged 36-48
- `Meta_Imp_Male_48_Plus`: Males aged 48+
- `Meta_Imp_Female_18_24`: Females aged 18-24
- `Meta_Imp_Female_24_36`: Females aged 24-36
- `Meta_Imp_Female_36_48`: Females aged 36-48
- `Meta_Imp_Female_48_Plus`: Females aged 48+

**Distribution**:
- Male: 18-24 (25%), 24-36 (40%), 36-48 (25%), 48+ (10%)
- Female: 18-24 (30%), 24-36 (35%), 36-48 (25%), 48+ (10%)

#### By Campaign Objective (4)
- `Meta_Imp_Objective_Sales`: Impressions for sales campaigns
- `Meta_Imp_Objective_Link_Clicks`: Impressions for link click campaigns
- `Meta_Clicks_Objective_Sales`: Clicks from sales campaigns
- `Meta_Clicks_Objective_Link_Clicks`: Clicks from link click campaigns

**Distribution**: Sales (60%), Link Clicks (40%)

#### By Media Type (4)
- `Meta_Imp_Image`: Impressions from image ads
- `Meta_Imp_Video`: Impressions from video ads
- `Meta_Clicks_Image`: Clicks from image ads
- `Meta_Clicks_Video`: Clicks from video ads

**Distribution**: Video (55%), Image (45%)
**Performance**: Video has higher CTR

#### By Audience Type (6)
- `Meta_Imp_Engaged`: Impressions to engaged audience
- `Meta_Imp_Prospecting`: Impressions to prospecting audience
- `Meta_Imp_Retargeting`: Impressions to retargeting audience
- `Meta_Clicks_Engaged`: Clicks from engaged audience
- `Meta_Clicks_Prospecting`: Clicks from prospecting audience
- `Meta_Clicks_Retargeting`: Clicks from retargeting audience

**Distribution**: Prospecting (50%), Engaged (30%), Retargeting (20%)

### YouTube Advertising Metrics (4)
| Column | Description |
|--------|-------------|
| `YouTube_Spend` | Total ad spend ($) |
| `YouTube_Impressions` | Total impressions |
| `YouTube_Clicks` | Total clicks |
| `YouTube_Views` | Video views |

**Key Insights**:
- Lower spend than Meta (~60% of Meta spend)
- Higher impressions per dollar
- Lower CTR (~1.5%)
- Longer lag effect (2-3 weeks)

### Direct Traffic Metrics (2)
| Column | Description |
|--------|-------------|
| `Direct_Sessions` | Direct website sessions |
| `Direct_Pageviews` | Total pageviews from direct traffic |

**Key Insights**:
- Baseline traffic with seasonal trends
- Immediate impact on sales
- ~3.5 pages per session

## Usage Examples

### Example 1: Find Meta's Impact on Amazon Sales
1. Select `Amazon_Total_Sales` as target
2. Set lag range 0-15
3. Look for `Meta_Spend` correlation
4. Expected result: Best correlation at lag +1 or +2

### Example 2: Compare Gender Performance
1. Select `Shopify_Net_Items_Sold` as target
2. Compare `Meta_Impressions_Male` vs `Meta_Impressions_Female`
3. Expected result: Female audience shows stronger correlation

### Example 3: Media Type Analysis
1. Select both `Amazon_Total_Sales` and `Shopify_Net_Items_Sold` as targets
2. Compare `Meta_Imp_Video` vs `Meta_Imp_Image`
3. Expected result: Video shows stronger correlation with sales

### Example 4: Audience Effectiveness
1. Select `Amazon_Total_Sales` as target
2. Compare `Meta_Imp_Engaged`, `Meta_Imp_Prospecting`, `Meta_Imp_Retargeting`
3. Expected result: Prospecting has highest volume, Retargeting has best efficiency

### Example 5: Cross-Platform Attribution
1. Select `Amazon_Total_Sales` as target
2. Look at `UTM_Meta`, `UTM_YouTube`, `UTM_Direct` correlations
3. Understand which channels drive Amazon traffic

## Data Generation Details

### Seasonality
- Annual trend: Growth from 100 to 150 over the year
- Seasonal pattern: Sine wave with 4 cycles per year
- Random noise: Added to all metrics for realism

### Lag Implementation
- Meta → Shopify: 0-1 week lag (coefficient: 0.12 immediate, 0.08 lag-1)
- Meta → Amazon: 1-2 week lag (coefficient: 0.08 lag-1, 0.05 lag-2)
- YouTube → Shopify: 1-2 week lag (coefficient: 0.10 lag-1, 0.06 lag-2)
- YouTube → Amazon: 2-3 week lag (coefficient: 0.06 lag-2, 0.04 lag-3)

### Conversion Funnels
- Amazon: Searches → Add to Cart (15%) → Sales (40% generic, 25% non-generic)
- Shopify: Sessions → Add to Cart (8%) → Sales (45%)

## Tips for Analysis

1. **Start with Total Metrics**: Use `Amazon_Total_Sales` and `Shopify_Net_Items_Sold` as primary targets
2. **Explore Lag Ranges**: Try 0-5 for immediate effects, 0-15 for longer-term effects
3. **Compare Segments**: Use gender, age, objective, media type, and audience breakdowns
4. **Look for Patterns**: Female audience, video content, and prospecting should show strong signals
5. **Validate Findings**: Cross-reference with multiple metrics (impressions, clicks, spend)

## Expected Correlations Summary

| Target | Feature | Expected Lag | Strength |
|--------|---------|--------------|----------|
| Amazon Sales | Meta Spend | 1-2 weeks | Strong (r > 0.7) |
| Amazon Sales | YouTube Spend | 2-3 weeks | Moderate (r > 0.5) |
| Shopify Sales | Meta Spend | 0-1 week | Strong (r > 0.7) |
| Shopify Sales | YouTube Spend | 1-2 weeks | Moderate (r > 0.5) |
| Shopify Sales | Meta Female Imp | 0-1 week | Strong (r > 0.7) |
| Shopify Sales | Meta Video Imp | 0-1 week | Strong (r > 0.7) |
| Amazon Sales | Direct Sessions | 0 weeks | Moderate (r > 0.4) |

## Loading the Data

### In the KPI Reporting App
1. Go to the "Ingestion" tab
2. Click "Upload File"
3. Select `cross_platform_marketing_data.csv`
4. Navigate to "Cross Platform Analysis"
5. Start exploring correlations!

### In Python
```python
import pandas as pd
df = pd.read_csv('cross_platform_marketing_data.csv')
print(df.head())
print(df.describe())
```

### In Excel
Simply open the CSV file in Excel or import it as a table.

## Questions This Data Can Answer

1. Which advertising platform has the strongest impact on Amazon sales?
2. What is the optimal lag between Meta ad spend and sales?
3. Does video content perform better than images for driving sales?
4. Which gender responds better to Meta advertising?
5. Which age group has the highest conversion rate?
6. How do different campaign objectives compare in effectiveness?
7. Is prospecting or retargeting more effective for sales?
8. What is the relationship between YouTube views and Amazon searches?
9. How does direct traffic correlate with overall sales?
10. Which UTM source drives the most Shopify sales?

---

**Generated**: 2024
**Purpose**: Cross-platform correlation analysis demonstration
**License**: Free to use for testing and demonstration
