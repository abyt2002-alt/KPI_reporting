from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile

from services.upload_summary import analyze_uploaded_file


router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.post("/upload-summary")
async def upload_summary(file: UploadFile = File(...)):
    try:
        content = await file.read()
        if not content:
            raise ValueError("Uploaded file is empty.")
        return analyze_uploaded_file(file.filename or "dataset", content)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
