"""FastAPI service for secure CRM file uploads with validation."""
from __future__ import annotations

import io
import json
import os
from collections import deque, defaultdict
from datetime import datetime, timedelta
from pathlib import Path
from typing import Deque, Dict, List, Tuple
from uuid import uuid4

import pandas as pd
from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from starlette.middleware.base import BaseHTTPMiddleware

BASE_DIR = Path(__file__).resolve().parent
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
METADATA_LOG = UPLOAD_DIR / "metadata.jsonl"

EXPECTED_COLUMNS: List[Tuple[str, str]] = [
    ("Invoice", "int"),
    ("CustomerID", "int"),
    ("CustomerName", "str"),
    ("Amount", "float"),
    ("Currency", "str"),
    ("InvoiceDate", "date"),
    ("Status", "str"),
]

ALLOWED_EXTENSIONS = {
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".csv": "text/csv",
}
ALLOWED_CONTENT_TYPES = {value for value in ALLOWED_EXTENSIONS.values()} | {
    "application/vnd.ms-excel",  # csv uploads on Windows often use this
}
MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024  # 3 MB
RATE_LIMIT = 30  # requests per minute
RATE_WINDOW_SECONDS = 60

app = FastAPI(title="CRM Upload Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Content-Security-Policy"] = "default-src 'none'"
        return response


class MemoryRateLimiter(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.requests: Dict[str, Deque[datetime]] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "anonymous"
        now = datetime.utcnow()
        window_start = now - timedelta(seconds=RATE_WINDOW_SECONDS)
        history = self.requests[client_ip]
        while history and history[0] < window_start:
            history.popleft()
        if len(history) >= RATE_LIMIT:
            raise HTTPException(status_code=429, detail="Rate limit exceeded. Please slow down.")
        history.append(now)
        return await call_next(request)


app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(MemoryRateLimiter)


def _extension(filename: str) -> str:
    return Path(filename).suffix.lower()


def _ensure_allowed_file(upload_file: UploadFile) -> str:
    ext = _extension(upload_file.filename or "")
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .xlsx, .xls, and .csv files are supported.",
        )
    if upload_file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported MIME type: {upload_file.content_type}",
        )
    return ext


async def _read_upload(upload_file: UploadFile) -> bytes:
    content = await upload_file.read()
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="File exceeds 3 MB limit.")
    return content


def _load_dataframe(content: bytes, ext: str) -> pd.DataFrame:
    buffer = io.BytesIO(content)
    if ext == ".csv":
        df = pd.read_csv(buffer)
    else:
        df = pd.read_excel(buffer)
    if df.empty:
        raise HTTPException(status_code=400, detail="Uploaded file contains no rows.")
    return df


def _validate_dataframe(df: pd.DataFrame) -> List[dict]:
    expected_headers = [col for col, _ in EXPECTED_COLUMNS]
    if list(df.columns) != expected_headers:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid headers. Expected exact columns: {', '.join(expected_headers)}",
        )

    errors: List[str] = []
    validated = df.copy()
    for column, dtype in EXPECTED_COLUMNS:
        if dtype == "int":
            validated[column] = pd.to_numeric(validated[column], errors="coerce").astype("Int64")
        elif dtype == "float":
            validated[column] = pd.to_numeric(validated[column], errors="coerce")
        elif dtype == "date":
            validated[column] = pd.to_datetime(validated[column], errors="coerce")
        else:
            validated[column] = validated[column].astype(str).str.strip()
        if validated[column].isnull().any():
            errors.append(f"Column '{column}' is missing or has invalid {dtype} values.")
    if errors:
        raise HTTPException(status_code=400, detail=errors)

    preview = (
        validated.head(10)
        .fillna("")
        .astype(str)
        .to_dict(orient="records")
    )
    return preview


def _save_artifact(content: bytes, ext: str, uploader_name: str, uploader_email: str) -> None:
    timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
    safe_name = f"upload_{timestamp}_{uuid4().hex}{ext}"
    destination = UPLOAD_DIR / safe_name
    with destination.open("wb") as fout:
        fout.write(content)

    record = {
        "file": safe_name,
        "uploaded_at": datetime.utcnow().isoformat(),
        "uploader": {"name": uploader_name, "email": uploader_email},
    }
    with METADATA_LOG.open("a", encoding="utf-8") as meta:
        meta.write(json.dumps(record) + "\n")


async def _process_file(upload_file: UploadFile) -> Tuple[List[dict], bytes, str]:
    ext = _ensure_allowed_file(upload_file)
    content = await _read_upload(upload_file)
    df = _load_dataframe(content, ext)
    preview = _validate_dataframe(df)
    return preview, content, ext


@app.get("/upload/health")
async def health() -> Dict[str, str]:
    return {"status": "ok", "message": "Upload service ready"}


@app.get("/upload/template")
async def download_template():
    template_data = pd.DataFrame([
        {
            "Invoice": 123456,
            "CustomerID": 7890,
            "CustomerName": "Ada Lovelace",
            "Amount": 1250.75,
            "Currency": "USD",
            "InvoiceDate": datetime.utcnow().date(),
            "Status": "Paid",
        }
    ])
    buffer = io.BytesIO()
    template_data.to_excel(buffer, index=False)
    buffer.seek(0)
    filename = "crm_upload_template.xlsx"
    headers = {"Content-Disposition": f"attachment; filename={filename}"}
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers,
    )


@app.post("/upload/validate")
async def validate_upload(file: UploadFile = File(...)):
    preview, _, _ = await _process_file(file)
    return {"message": "File validated successfully.", "preview": preview, "rowCount": len(preview)}


@app.post("/upload/submit")
async def finalize_upload(
    uploader_name: str = Form(..., min_length=2),
    uploader_email: str = Form(..., min_length=3),
    file: UploadFile = File(...),
):
    preview, content, ext = await _process_file(file)
    _save_artifact(content, ext, uploader_name, uploader_email)
    return {
        "message": "Upload complete.",
        "preview": preview,
        "saved": True,
    }