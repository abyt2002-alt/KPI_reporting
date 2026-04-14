# Cross Platform Analysis Feature

## Overview

The Cross Platform Analysis tab provides multi-target correlation analysis with lag detection and rolling sum capabilities. This feature helps identify relationships between different platforms and understand delayed effects.

## Key Features

### 1. Multi-Target Selection
- Select multiple target variables (e.g., Sales channels, Revenue streams)
- Analyze correlations between each target and all other numeric columns
- View results in organized, color-coded tables

### 2. Analysis Modes

#### Lag Analysis Mode
- Tests correlations at different time lags (configurable range)
- Identifies optimal lag where correlation is strongest
- Positive lag: Feature leads target (e.g., Ad Spend → Sales after 2 weeks)
- Negative lag: Target leads feature
- Shows both r(0) (immediate) and Best r (at optimal lag)

#### Rolling Sum Mode
- Correlates feature with rolling sum of target over N periods
- Useful for cumulative effects analysis
- Configurable window size

### 3. Data Filtering
- Time range filtering with date picker
- Filter by date column
- Apply filters before analysis

### 4. Visual Analysis
- Click any correlation row to see detailed charts
- Lag analysis bar chart showing correlation at each lag
- Aligned trend chart with lag applied
- Color-coded correlation strength:
  - Green: Strong positive (|r| > 0.7)
  - Red: Strong negative (|r| > 0.7)
  - Yellow: Moderate (|r| > 0.4)
  - Gray: Weak (|r| ≤ 0.4)

## How to Use

1. **Upload Data**: Go to Ingestion tab and upload your dataset
2. **Navigate**: Click "Cross Platform Analysis" in the sidebar
3. **Select Targets**: Choose one or more target variables to analyze
4. **Configure**:
   - Choose analysis mode (Lag or Rolling Sum)
   - Set lag range (e.g., 0 to 15) or rolling window size
   - Apply data filters if needed
5. **Analyze**: View correlation tables sorted by strength
6. **Explore**: Click any row to see detailed lag analysis and trend charts

## Use Cases

### Marketing Attribution
- Identify which ad platforms correlate with sales
- Find optimal lag between ad spend and conversions
- Compare effectiveness across channels

### Cross-Platform Effects
- Analyze how Google Ads affects Amazon sales
- Measure delayed impact of TV campaigns on digital channels
- Understand platform synergies

### Sales Forecasting
- Identify leading indicators for sales
- Determine optimal time windows for predictions
- Build better forecasting models

## Technical Details

### Correlation Calculation
Uses Pearson correlation coefficient:
```
r = Σ[(xᵢ - x̄)(yᵢ - ȳ)] / √[Σ(xᵢ - x̄)² × Σ(yᵢ - ȳ)²]
```

### Lag Implementation
- Positive lag: Shifts feature back in time
- Negative lag: Shifts target back in time
- Tests all lags in specified range
- Returns lag with highest absolute correlation

### Rolling Sum
- Calculates forward-looking rolling sum of target
- Correlates with feature at each point
- Window size determines sum period

## Tips

1. **Start with reasonable lag ranges**: Marketing effects typically 0-8 weeks
2. **Use filters to focus analysis**: Remove outliers or focus on specific periods
3. **Look for consistent patterns**: Strong correlations across multiple targets are more reliable
4. **Consider business context**: High correlation doesn't imply causation
5. **Validate findings**: Use insights to inform modeling and testing

## Example Workflow

1. Upload weekly sales and marketing data
2. Select "Amazon Sales" and "Shopify Sales" as targets
3. Set lag range 0-15 weeks
4. Apply time filter to focus on recent data
5. Review correlation tables - see Google Ads has r=0.85 at lag +2
6. Click to view detailed charts
7. Interpret: Google Ads spend correlates with sales 2 weeks later
8. Use this insight in campaign planning and MMM modeling
