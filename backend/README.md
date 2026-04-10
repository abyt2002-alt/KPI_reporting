# Backend API

FastAPI backend for Report Maker - handles ML models and data processing.

## Structure

```
backend/
├── main.py              # FastAPI app entry point
├── requirements.txt     # Python dependencies
├── models/              # ML models
│   ├── __init__.py
│   ├── regression.py    # Linear, Ridge, Lasso regression
│   └── optimization.py  # Budget optimization, response curves
└── utils/               # Utilities
    ├── __init__.py
    └── data_processing.py  # Data cleaning, normalization
```

## Setup

```bash
cd backend

# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Mac/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

## Run

```bash
# Development
uvicorn main:app --reload --port 8000

# Production
uvicorn main:app --host 0.0.0.0 --port 8000
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Health check |
| GET | `/health` | Health status |
| POST | `/upload` | Upload CSV file |
| POST | `/analyze/correlation` | Calculate correlations |
| POST | `/predict` | Run prediction model |

## API Docs

Once running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Adding Your Models

1. Create a new file in `models/` folder
2. Import and use in `main.py`
3. Create API endpoint

Example:
```python
# models/my_model.py
def my_prediction(data):
    # Your model logic
    return result

# main.py
from models.my_model import my_prediction

@app.post("/my-endpoint")
async def run_my_model(request: MyRequest):
    result = my_prediction(request.data)
    return result
```
