# Quick Start Guide: Cross Platform Analysis

## Step-by-Step Tutorial

### Step 1: Load the Data
1. Start the KPI Reporting application
2. Navigate to the **Ingestion** tab (sidebar)
3. Click **Upload File** or drag and drop
4. Select `cross_platform_marketing_data.csv`
5. Wait for the upload to complete

### Step 2: Navigate to Cross Platform Analysis
1. Click **Cross Platform Analysis** in the sidebar
2. You should see the main analysis interface

### Step 3: Your First Analysis - Meta Impact on Amazon Sales

#### Select Target
1. Click the **"Select target variables..."** dropdown
2. Check **Amazon_Total_Sales**
3. Click outside to close the dropdown

#### Configure Analysis
1. **Analysis Mode**: Keep "Lag Analysis" selected
2. **Lag Range**: Set Min: 0, Max: 15
3. Leave filters empty for now

#### View Results
- You'll see a table showing all correlations with Amazon_Total_Sales
- Look for **Meta_Spend** - it should be near the top
- Note the **Best r** value (should be ~0.7-0.8)
- Note the **Lag** value (should be +1 or +2)

#### Interpret
- **r(0)**: Immediate correlation (same week)
- **Best r**: Strongest correlation found
- **Lag**: +2 means Meta spend correlates with sales 2 weeks later

#### Detailed View
1. Click on the **Meta_Spend** row
2. A modal opens showing:
   - **Lag Analysis Chart**: Bar chart of correlation at each lag
   - **Aligned Trends**: Line chart showing Meta spend vs Amazon sales with lag applied
3. The peak in the lag chart shows the optimal lag
4. The trend chart shows how well they align when shifted

### Step 4: Compare Multiple Targets

#### Select Multiple Targets
1. Click the target dropdown again
2. Check both:
   - **Amazon_Total_Sales**
   - **Shopify_Net_Items_Sold**
3. Click outside to close

#### View Side-by-Side
- Now you see two tables side by side
- Compare how Meta_Spend affects both platforms
- Notice Shopify has shorter lag (0-1 week) vs Amazon (1-2 weeks)

### Step 5: Explore Gender Differences

#### Add More Targets
1. Keep your current targets selected
2. Scroll through the correlation tables
3. Look for:
   - **Meta_Impressions_Male**
   - **Meta_Impressions_Female**
4. Compare their correlation values
5. Female impressions should show stronger correlation

### Step 6: Try Rolling Sum Mode

#### Switch Mode
1. Click **Rolling Sum** button in Analysis Mode
2. Set **Rolling Window Size**: 4
3. View updated results

#### Interpret Rolling Sum
- Instead of lag, this shows correlation with 4-week cumulative sales
- **r(Σ4)**: Correlation with sum of next 4 weeks
- **Window**: Shows the window size used
- Useful for understanding cumulative campaign effects

### Step 7: Apply Time Filters

#### Set Time Range
1. Expand the **Data Filters** section
2. **Time Column**: Select "Week"
3. **From Date**: Select 2024-03-01
4. **To Date**: Select 2024-09-01
5. Click **Apply Filters**

#### View Filtered Results
- Analysis now runs only on selected time period
- Useful for seasonal analysis or excluding outliers
- Click **Clear** to remove filters

### Step 8: Advanced Analysis - Media Type Comparison

#### Setup
1. **Targets**: Select Amazon_Total_Sales and Shopify_Net_Items_Sold
2. **Mode**: Lag Analysis
3. **Lag Range**: 0-15

#### Compare
Look for these metrics in the tables:
- **Meta_Imp_Video** vs **Meta_Imp_Image**
- **Meta_Clicks_Video** vs **Meta_Clicks_Image**

#### Expected Findings
- Video impressions show stronger correlation
- Video clicks have better conversion correlation
- This suggests video content is more effective

### Step 9: Audience Segmentation Analysis

#### Find Audience Metrics
In your correlation tables, look for:
- **Meta_Imp_Engaged**
- **Meta_Imp_Prospecting**
- **Meta_Imp_Retargeting**

#### Compare Performance
- **Prospecting**: Highest volume (50% of impressions)
- **Engaged**: Good balance of volume and efficiency
- **Retargeting**: Smallest volume but potentially highest efficiency

#### Click for Details
- Click on each audience type row
- Compare lag patterns
- Retargeting might show shorter lag (more immediate response)

### Step 10: Cross-Platform Attribution

#### Setup
1. **Target**: Shopify_Net_Items_Sold
2. Look for UTM source metrics:
   - UTM_Meta
   - UTM_YouTube
   - UTM_Direct
   - UTM_Google
   - UTM_Email

#### Insights
- See which traffic source has strongest correlation with sales
- Understand attribution across channels
- Meta should be the strongest source

## Common Analysis Patterns

### Pattern 1: Find Optimal Ad Timing
**Question**: When should we run Meta ads for maximum Amazon impact?

1. Target: Amazon_Total_Sales
2. Feature: Meta_Spend
3. Look at lag value (e.g., +2)
4. **Answer**: Run ads 2 weeks before you want sales spike

### Pattern 2: Budget Allocation
**Question**: Should we invest more in Meta or YouTube?

1. Targets: Amazon_Total_Sales, Shopify_Net_Items_Sold
2. Compare Meta_Spend vs YouTube_Spend correlations
3. Meta should show stronger correlation
4. **Answer**: Meta has stronger, faster impact

### Pattern 3: Creative Optimization
**Question**: Should we use more video or image ads?

1. Target: Shopify_Net_Items_Sold
2. Compare Meta_Imp_Video vs Meta_Imp_Image
3. Video should show higher correlation
4. **Answer**: Prioritize video content

### Pattern 4: Audience Targeting
**Question**: Which audience should we target?

1. Target: Amazon_Total_Sales
2. Compare Meta_Imp_Engaged, Prospecting, Retargeting
3. Look at both correlation strength and lag
4. **Answer**: Balance volume (prospecting) with efficiency (retargeting)

### Pattern 5: Gender Targeting
**Question**: Should we target male or female audience?

1. Target: Shopify_Net_Items_Sold
2. Compare Meta_Impressions_Male vs Meta_Impressions_Female
3. Female should show stronger correlation
4. **Answer**: Female audience more responsive

## Tips & Tricks

### 1. Start Broad, Then Narrow
- Begin with total metrics (Amazon_Total_Sales, Meta_Spend)
- Once you find strong correlations, drill into segments
- Compare gender, age, media type, etc.

### 2. Use Multiple Targets
- Select 2-3 targets to compare patterns
- See if correlations are consistent across platforms
- Identify platform-specific effects

### 3. Adjust Lag Range
- Short lag (0-5): For immediate effects, social media
- Medium lag (0-10): For most marketing activities
- Long lag (0-15): For brand building, TV, long sales cycles

### 4. Filter Strategically
- Remove holiday periods if they skew results
- Focus on specific seasons
- Exclude data quality issues

### 5. Look for Consistency
- Strong correlation + logical lag = reliable insight
- Weak correlation might indicate:
  - No real relationship
  - Wrong lag range
  - Confounding variables
  - Data quality issues

### 6. Color Coding Guide
- **Green** (r > 0.7): Strong positive - reliable relationship
- **Red** (r < -0.7): Strong negative - inverse relationship
- **Yellow** (0.4 < |r| < 0.7): Moderate - worth investigating
- **Gray** (|r| < 0.4): Weak - likely noise

### 7. Interpret Lag Values
- **Lag 0**: Immediate effect (same week)
- **Lag +1**: Feature leads by 1 week
- **Lag +2**: Feature leads by 2 weeks
- **Lag -1**: Target leads by 1 week (rare in marketing)

## Troubleshooting

### No Strong Correlations Found
- Try different lag ranges
- Check if data has enough variation
- Apply filters to remove noise
- Consider rolling sum mode

### Unexpected Lag Values
- Very high lag (>10) might be spurious
- Negative lag in marketing is unusual
- Check data alignment and date columns

### Tables Look Empty
- Make sure you selected target variables
- Check that dataset is loaded
- Verify numeric columns exist

### Modal Won't Open
- Make sure you clicked on a data row (not header)
- Check browser console for errors
- Refresh the page if needed

## Next Steps

After mastering the basics:

1. **Export Insights**: Take screenshots of key findings
2. **Build Reports**: Document correlation patterns
3. **Inform Strategy**: Use lag insights for campaign timing
4. **Test Hypotheses**: Run A/B tests based on findings
5. **Iterate**: Continuously analyze new data

## Example Questions to Explore

1. ✅ What's the optimal lag between Meta spend and Amazon sales?
2. ✅ Does YouTube have a longer lag than Meta?
3. ✅ Which gender responds better to Meta ads?
4. ✅ Is video or image content more effective?
5. ✅ Which age group has the strongest correlation with sales?
6. ✅ How do sales vs link click objectives compare?
7. ✅ Is prospecting or retargeting more effective?
8. ✅ What's the relationship between searches and sales?
9. ✅ How does direct traffic correlate with paid channels?
10. ✅ Which UTM source drives the most conversions?

---

**Happy Analyzing!** 🚀

For more details, see:
- `CROSS_PLATFORM_ANALYSIS.md` - Feature documentation
- `DATASET_README.md` - Dataset details and column definitions
