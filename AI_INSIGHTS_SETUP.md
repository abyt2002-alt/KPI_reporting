# AI Insights Integration - Complete Setup

## Overview
Real AI-powered insights using Google Gemini 2.0 Flash have been integrated into the Trinity Insights section of the KPI dashboard.

## What Was Done

### 1. Backend Setup
- **File**: `backend/services/ai_insights.py`
  - Created AI insights generation service using Google Gemini API
  - Implements strict business analyst prompt with no recommendations
  - Generates: headline, 3 bullets, green flag, red flag
  - Uses 16 data points (8 metrics × 2 values each: current value + % change)

- **File**: `backend/routes/ai_insights_routes.py`
  - Created `/ai/generate-insights` POST endpoint
  - Accepts 8 KPI metrics with values and change percentages
  - Returns structured insights in JSON format

- **File**: `backend/main.py`
  - Added AI insights router to FastAPI app

### 2. Frontend Integration
- **File**: `src/services/api.ts`
  - Added `generateAIInsights()` function
  - Calls `/ai/generate-insights` endpoint

- **File**: `src/modules/SummaryPage.tsx`
  - Modified `refreshAiSummary()` function to use real AI
  - Extracts 8 metrics from dashboard cards
  - Transforms AI response to match UI format

### 3. Environment Configuration
- **File**: `backend/.env`
  ```
  GEMINI_API_KEY=AIzaSyBijrM8nis36uamfQrx6U6LxbifTGejCMI
  GEMINI_FLASH_MODEL=gemini-2.5-flash
  ```

## The 8 KPI Metrics Used

The AI receives these 16 values (8 metrics with current value + % change):

1. **Revenue** - Total sales ($547.9K, +11.5%)
2. **Orders** - Placed orders (10,353, +7.1%)
3. **Media Spend** - Total ad spend ($58.2K, +10.4%)
4. **Google Spend** - Google channel spend ($24.4K, +10.4%)
5. **AOV** - Average order value ($53, +0.1%)
6. **New Customers %** - New customer share (33.4%, +1.4%)
7. **Meta ROAS** - Meta return on ad spend (2.80, +1.7%)
8. **Google ROAS** - Google return on ad spend (3.33, +5.0%)

## AI Prompt Instructions

The AI follows strict rules:
- **Reporter, not advisor** - States facts, no recommendations
- **No judgement words** - No "strong", "weak", "healthy", "poor"
- **Numbers required** - Every claim must include specific numbers
- **Headline has zero numbers** - Only themes, no metrics
- **Bullets must have numbers** - At least one specific number per bullet
- **No derived metrics** - Don't calculate ROAS or other metrics not provided
- **Tight language** - No filler like "it is worth noting"

## Output Format

```json
{
  "headline": "In All Markets for All Products over the Last 30 days, revenue growing efficiently while new customer acquisition accelerates",
  "bullets": [
    "Revenue reached $547.9K, up 11.5%, supported by 10,353 orders, up 7.1%. New customer share increased to 33.4%, up 1.4 percentage points, indicating buyer base expansion alongside top line growth.",
    "Media spend totaled $58.2K, up 10.4%, while revenue grew 11.5%, creating a 1.1 percentage point efficiency gap favoring revenue growth.",
    "Google ROAS reached 3.33, up 5.0%, with Google spend at $24.4K, up 10.4%. Meta ROAS stood at 2.80, up 1.7%, with implied Meta spend of $33.8K. Google holds 42% of total budget with a 0.53 ROAS advantage."
  ],
  "green_flag": "**Green flag:** Google ROAS increased 5.0% to 3.33 while Meta ROAS grew 1.7% to 2.80, showing returns improving across both platforms.",
  "red_flag": "🚩 **Red flag:** AOV increased only 0.1% to $53 while orders grew 7.1%, indicating basket size growth is not keeping pace with order volume expansion."
}
```

## How It Works

1. User clicks "Refresh insights" button
2. Frontend extracts 8 metrics from dashboard cards
3. Sends 16 values to `/ai/generate-insights` endpoint
4. Backend calls Gemini API with structured prompt
5. AI generates insights following strict rules
6. Response is transformed and displayed in Trinity Insights section

## Testing

Test the Gemini API connection:
```bash
cd kpi_reporting/backend
python test_gemini.py
```

Expected output:
```
✅ API Key found: AIzaSyBijrM8nis36uamfQrx6U6LxbifTGejCMI...
✅ Model: gemini-2.5-flash
🧪 Testing Gemini API...
✅ API Response: {"message": "Hello from Gemini!"}
✅ Gemini API is working!
```

## Running the Application

1. Start backend:
```bash
cd kpi_reporting/backend
python main.py
```

2. Start frontend:
```bash
cd kpi_reporting
npm run dev
```

3. Open http://localhost:5175
4. Navigate to Summary/KPI Overview tab
5. Click "Refresh insights" to generate real AI insights

## API Key Security

⚠️ **IMPORTANT**: The API key in `.env` should be rotated after testing. Never commit API keys to git.

To rotate the key:
1. Go to https://aistudio.google.com/apikey
2. Generate a new API key
3. Update `backend/.env` with new key
4. Delete the old key from Google AI Studio

## Troubleshooting

### "API key not configured" error
- Check that `backend/.env` exists and contains `GEMINI_API_KEY`
- Restart the backend server after adding the key

### "Failed to generate insights" error
- Check backend logs for detailed error message
- Verify API key is valid at https://aistudio.google.com/apikey
- Check network connection

### Insights not updating
- Click "Refresh insights" button
- Check browser console for errors
- Verify backend is running on port 8002

## Next Steps

1. **Test with real data** - Verify insights quality with actual KPI values
2. **Adjust prompt** - Fine-tune the system prompt if needed
3. **Add caching** - Cache insights to reduce API calls
4. **Monitor costs** - Track Gemini API usage and costs
5. **Rotate API key** - Replace the test key with a production key

## Files Modified

Backend:
- `backend/services/ai_insights.py` (new)
- `backend/routes/ai_insights_routes.py` (new)
- `backend/main.py` (modified)
- `backend/requirements.txt` (modified)
- `backend/.env` (modified)

Frontend:
- `src/services/api.ts` (modified)
- `src/modules/SummaryPage.tsx` (modified)

## Dependencies Added

- `google-genai>=1.0.0` - Google Gemini AI SDK

---

**Status**: ✅ Complete and ready for testing
**Last Updated**: 2026-04-14
