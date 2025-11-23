from __future__ import annotations

import base64
import io
from collections import defaultdict, deque
from datetime import datetime, timedelta
from functools import wraps
from pathlib import Path
from uuid import uuid4
import hashlib
import json
import os
import re
from typing import Any, Deque, Dict, Iterable, List, Optional
from urllib.parse import quote_plus

import joblib
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.exc import SQLAlchemyError
import numpy as np
import pandas as pd

from CrmModel.sales_regression_model import (
    CATEGORICAL_FEATURES,
    NUMERIC_FEATURES,
    engineer_features,
    DEFAULT_MODEL_PATH as CRM_DEFAULT_MODEL_PATH,
)

BASE_DIR = Path(__file__).resolve().parent
DATA_PATH = BASE_DIR / "data" / "transactions.csv"
MODEL_BASE_DIR = BASE_DIR / "CrmModel"
MODEL_PATH = Path(os.getenv("MODEL_PATH", MODEL_BASE_DIR / CRM_DEFAULT_MODEL_PATH))
PREDICTION_REQUIRED_COLUMNS = [
    "Invoice",
    "StockCode",
    "Description",
    "Quantity",
    "InvoiceDate",
    "Price",
    "Customer ID",
    "Country",
]

FIELD_ALIASES = {
    "customer_id": "Customer ID",
    "CustomerID": "Customer ID",
    "invoice_no": "Invoice",
    "InvoiceNo": "Invoice",
    "InvoiceNo.": "Invoice",
    "invoice": "Invoice",
    "UnitPrice": "Price",
    "unit_price": "Price",
}
DATE_ALIASES = ["invoice_date", "Invoice Timestamp", "InvoiceDateTime"]

_prediction_model = None

SEGMENT_OFFERS = {
    "Top Spenders": "VIP 15% Discount",
    "Loyal Customers": "Early Access Deals",
    "At Risk Customers": "10% Comeback Coupon",
    "New Customers": "Welcome Offer",
    "Low Value Customers": "Bundle Discount",
}

UPLOAD_SCHEMA: List[Dict[str, Any]] = [
    {"key": "Invoice", "type": "int", "required": True, "description": "Numeric invoice identifier."},
    {"key": "CustomerID", "type": "int", "required": True, "description": "Unique CRM customer id."},
    {"key": "CustomerName", "type": "str", "required": True, "description": "Full customer name."},
    {"key": "Amount", "type": "float", "required": True, "description": "Invoice total amount."},
    {"key": "Currency", "type": "str", "required": True, "description": "ISO currency code."},
    {"key": "InvoiceDate", "type": "date", "required": True, "description": "Invoice date (YYYY-MM-DD)."},
    {"key": "Status", "type": "str", "required": True, "description": "Status label (e.g., Paid)."},
]
UPLOAD_EXPECTED_COLUMNS = [column["key"] for column in UPLOAD_SCHEMA]
UPLOAD_SAMPLE_ROW = {
    "Invoice": 123456,
    "CustomerID": 7890,
    "CustomerName": "Ada Lovelace",
    "Amount": 1250.75,
    "Currency": "USD",
    "InvoiceDate": datetime.utcnow().date().isoformat(),
    "Status": "Paid",
}
MAX_UPLOAD_ROWS = int(os.getenv("MAX_UPLOAD_ROWS", 5000))
MAX_JSON_PAYLOAD_BYTES = int(os.getenv("MAX_UPLOAD_JSON_BYTES", 1_000_000))
UPLOAD_RATE_LIMIT = int(os.getenv("UPLOAD_RATE_LIMIT", 30))
UPLOAD_RATE_WINDOW_SECONDS = int(os.getenv("UPLOAD_RATE_WINDOW_SECONDS", 60))
UPLOAD_TEMPLATE_FILENAME = "crm_upload_template.xlsx"
UPLOAD_TEMPLATE_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
EMAIL_REGEX = re.compile(r"^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$")
_rate_limit_history: Dict[str, Deque[datetime]] = defaultdict(deque)
# Use SQLite for easier testing
DEFAULT_DB_URL = "sqlite:///app.db"
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000")

db = SQLAlchemy()
cors = CORS()


def _allowed_frontend_origins() -> List[str]:
    raw = os.getenv("FRONTEND_ORIGINS")
    if raw:
        origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
        if origins:
            return origins
    return sorted({FRONTEND_ORIGIN, "http://localhost:3000"})


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    role = db.Column(db.String(20), nullable=False, default="User")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    uploads = db.relationship("UploadRecord", backref="uploader", lazy=True)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "email": self.email,
            "role": self.role,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class UploadRecord(db.Model):
    __tablename__ = "uploads"

    id = db.Column(db.Integer, primary_key=True)
    upload_id = db.Column(db.String(64), unique=True, nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    original_filename = db.Column(db.String(255))
    uploaded_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    row_count = db.Column(db.Integer, nullable=False)
    data_json = db.Column(db.JSON, nullable=False)
    meta_json = db.Column(db.JSON, nullable=False)


def json_response(success: bool, message: str, data: Optional[Dict[str, Any]] = None, status: int = 200):
    payload = {"success": success, "message": message, "data": data or {}}
    response = jsonify(payload)
    response.status_code = status
    return response


def load_transactions() -> pd.DataFrame:
    # Load transactions from the database
    try:
        # Get all upload records
        uploads = UploadRecord.query.all()
        
        # If no uploads exist, return empty DataFrame
        if not uploads:
            return pd.DataFrame()
        
        # Combine all upload data into a single DataFrame
        all_data = []
        for upload in uploads:
            if upload.data_json:
                all_data.extend(upload.data_json)
        
        # If no data exists, return empty DataFrame
        if not all_data:
            return pd.DataFrame()
        
        # Convert to DataFrame
        df = pd.DataFrame(all_data)
        
        # Ensure required columns exist
        if "InvoiceDate" not in df.columns or "CustomerID" not in df.columns:
            # Try to map common column names
            column_mapping = {
                "Invoice Date": "InvoiceDate",
                "Customer ID": "CustomerID",
                "CustomerID": "CustomerID",
                "invoice_date": "InvoiceDate",
                "customer_id": "CustomerID"
            }
            
            # Apply column mapping
            for old_name, new_name in column_mapping.items():
                if old_name in df.columns:
                    df.rename(columns={old_name: new_name}, inplace=True)
        
        # Check again after mapping
        if "InvoiceDate" not in df.columns or "CustomerID" not in df.columns:
            raise ValueError("Data must contain InvoiceDate and CustomerID columns")
        
        # Convert InvoiceDate to datetime
        df["InvoiceDate"] = pd.to_datetime(df["InvoiceDate"], errors="coerce")
        df = df.dropna(subset=["InvoiceDate", "CustomerID"])
        
        # Calculate TotalAmount if not present
        if "TotalAmount" not in df.columns:
            if "Amount" in df.columns:
                df["TotalAmount"] = df["Amount"]
            elif "Quantity" in df.columns and "Price" in df.columns:
                df["TotalAmount"] = df["Quantity"] * df["Price"]
            else:
                df["TotalAmount"] = 0
        
        # Fill any missing TotalAmount values
        df["TotalAmount"] = df["TotalAmount"].fillna(0)
        
        return df
    except Exception as e:
        # If there's an error, return empty DataFrame
        print(f"Error loading transactions: {e}")
        return pd.DataFrame()


def build_rfm_segments(df: pd.DataFrame) -> tuple[pd.DataFrame, list[dict], list[dict]]:
    if df.empty:
        return df, [], []

    now = datetime.utcnow()

    def recency(series: pd.Series) -> int:
        return int((now - series.max()).days)

    grouped = (
        df.groupby("CustomerID")
        .agg(
            recency=("InvoiceDate", recency),
            frequency=("InvoiceDate", "count"),
            monetary=("TotalAmount", "sum"),
        )
        .reset_index()
    )

    recency_low = np.percentile(grouped["recency"], 30)
    recency_high = np.percentile(grouped["recency"], 70)
    freq_high = np.percentile(grouped["frequency"], 80)
    freq_low = np.percentile(grouped["frequency"], 30)
    monetary_high = np.percentile(grouped["monetary"], 80)
    monetary_low = np.percentile(grouped["monetary"], 35)

    def assign_segment(row: pd.Series) -> str:
        if row["monetary"] >= monetary_high:
            return "Top Spenders"
        if row["frequency"] >= freq_high and row["recency"] <= recency_high:
            return "Loyal Customers"
        if row["recency"] >= recency_high:
            return "At Risk Customers"
        if row["recency"] <= recency_low and row["frequency"] <= freq_low:
            return "New Customers"
        if row["monetary"] <= monetary_low:
            return "Low Value Customers"
        return "Loyal Customers"

    grouped["segment"] = grouped.apply(assign_segment, axis=1)
    grouped["offer"] = grouped["segment"].map(SEGMENT_OFFERS)

    customers = grouped.sort_values("monetary", ascending=False).to_dict("records")

    summary_df = grouped.groupby("segment").size().reset_index(name="count")
    summary = [
        {
            "segment": row["segment"],
            "count": int(row["count"]),
            "suggested_offer": SEGMENT_OFFERS.get(row["segment"]),
        }
        for row in summary_df.to_dict("records")
    ]

    return grouped, customers, summary


def compute_file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            digest.update(chunk)
    return digest.hexdigest()


def compute_merkle_root(df: pd.DataFrame) -> str:
    if df.empty:
        return ""

    leaves = [
        hashlib.sha256(
            "|".join(
                [
                    str(row.InvoiceDate),
                    str(row.CustomerID),
                    str(row.Quantity),
                    str(row.UnitPrice),
                    str(row.TotalAmount),
                ]
            ).encode("utf-8")
        ).hexdigest()
        for row in df.itertuples()
    ]

    nodes = leaves
    if not nodes:
        return ""

    while len(nodes) > 1:
        if len(nodes) % 2 == 1:
            nodes.append(nodes[-1])
        next_level = []
        for i in range(0, len(nodes), 2):
            combined = (nodes[i] + nodes[i + 1]).encode("utf-8")
            next_level.append(hashlib.sha256(combined).hexdigest())
        nodes = next_level

    return nodes[0]


class UploadValidationError(Exception):
    def __init__(self, errors: List[str]):
        self.errors = errors
        super().__init__("; ".join(errors))


class UploadRateLimitError(Exception):
    """Raised when upload endpoints exceed configured rate limits."""


def _enforce_rate_limit(bucket: str, remote_addr: Optional[str]) -> None:
    client = remote_addr or "anonymous"
    key = f"{bucket}:{client}"
    history = _rate_limit_history[key]
    now = datetime.utcnow()
    window_start = now - timedelta(seconds=UPLOAD_RATE_WINDOW_SECONDS)
    while history and history[0] < window_start:
        history.popleft()
    if len(history) >= UPLOAD_RATE_LIMIT:
        raise UploadRateLimitError("Rate limit exceeded. Please retry shortly.")
    history.append(now)


def _is_blank(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    return False


def _sanitize_string(value: Any, max_length: int = 255) -> str:
    if value is None:
        return ""
    sanitized = str(value).strip().replace("\r", " ").replace("\n", " ")
    return sanitized[:max_length]


def _coerce_value(value: Any, expected_type: str, column_label: str, row_index: int) -> Any:
    if expected_type == "int":
        try:
            parsed = int(str(value).strip())
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Row {row_index}: '{column_label}' must be an integer.") from exc
        return parsed
    if expected_type == "float":
        try:
            parsed = float(str(value).strip())
        except (TypeError, ValueError) as exc:
            raise ValueError(f"Row {row_index}: '{column_label}' must be a number.") from exc
        return parsed
    if expected_type == "date":
        if isinstance(value, datetime):
            return value.date().isoformat()
        text = _sanitize_string(value)
        normalized = text.replace("Z", "+00:00")
        parse_attempts = [normalized, text]
        for candidate in parse_attempts:
            try:
                parsed_dt = datetime.fromisoformat(candidate)
                return parsed_dt.date().isoformat()
            except ValueError:
                pass
        for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
            try:
                return datetime.strptime(text, fmt).date().isoformat()
            except ValueError:
                continue
        raise ValueError(f"Row {row_index}: '{column_label}' must be a valid date (YYYY-MM-DD).")
    return _sanitize_string(value)


def _validate_row(row: Dict[str, Any], row_index: int) -> tuple[Dict[str, Any], List[str]]:
    if not isinstance(row, dict):
        return {}, [f"Row {row_index}: must be an object with the expected columns."]
    sanitized: Dict[str, Any] = {}
    errors: List[str] = []
    for column in UPLOAD_SCHEMA:
        key = column["key"]
        raw = row.get(key)
        if _is_blank(raw):
            if column["required"]:
                errors.append(f"Row {row_index}: '{key}' is required.")
            sanitized[key] = ""
            continue
        try:
            sanitized[key] = _coerce_value(raw, column["type"], key, row_index)
        except ValueError as exc:
            errors.append(str(exc))
    return sanitized, errors


def _sanitize_meta(meta_raw: Any, row_count: int) -> Dict[str, Any]:
    if not isinstance(meta_raw, dict):
        meta_raw = {}
    original_filename = _sanitize_string(meta_raw.get("originalFilename")) or "unknown.xlsx"
    upload_time_raw = meta_raw.get("uploadTime")
    if upload_time_raw:
        text = _sanitize_string(upload_time_raw)
        normalized = text.replace("Z", "+00:00")
        try:
            upload_time = datetime.fromisoformat(normalized).isoformat()
        except ValueError as exc:
            raise UploadValidationError(["meta.uploadTime must be ISO-8601 formatted."]) from exc
    else:
        upload_time = datetime.utcnow().isoformat()
    warnings_raw = meta_raw.get("warnings", [])
    warnings: List[str] = []
    if isinstance(warnings_raw, list):
        for item in warnings_raw:
            text = _sanitize_string(item)
            if text:
                warnings.append(text)
    meta = {
        "originalFilename": original_filename,
        "uploadTime": upload_time,
        "warnings": warnings,
        "serverReceivedAt": datetime.utcnow().isoformat(),
        "rowCount": row_count,
    }
    return meta


def _validate_upload_payload(payload: Any) -> Dict[str, Any]:
    if not isinstance(payload, dict):
        raise UploadValidationError(["Payload must be a JSON object."])
    columns = payload.get("columns")
    if columns != UPLOAD_EXPECTED_COLUMNS:
        raise UploadValidationError([
            "Columns must exactly match: " + ", ".join(UPLOAD_EXPECTED_COLUMNS)
        ])
    data = payload.get("data")
    if not isinstance(data, list) or not data:
        raise UploadValidationError(["'data' must be a non-empty array of rows."])
    if len(data) > MAX_UPLOAD_ROWS:
        raise UploadValidationError([f"A maximum of {MAX_UPLOAD_ROWS} rows is allowed per upload."])

    sanitized_rows: List[Dict[str, Any]] = []
    row_errors: List[str] = []
    for idx, row in enumerate(data, start=1):
        sanitized, errors = _validate_row(row, idx)
        if errors:
            row_errors.extend(errors)
        else:
            sanitized_rows.append(sanitized)
    if row_errors:
        raise UploadValidationError(row_errors)

    meta = _sanitize_meta(payload.get("meta"), len(sanitized_rows))
    return {
        "rows": sanitized_rows,
        "columns": UPLOAD_EXPECTED_COLUMNS,
        "meta": meta,
    }


def _persist_upload(validated: Dict[str, Any]) -> UploadRecord:
    # Create a default user for uploads since we removed authentication
    default_user = User.query.filter_by(email="default@example.com").first()
    if not default_user:
        default_user = User(email="default@example.com", role="User")
        db.session.add(default_user)
        db.session.flush()  # Get the user ID without committing
    
    record = UploadRecord(
        upload_id=uuid4().hex,
        user_id=default_user.id,
        original_filename=validated["meta"]["originalFilename"],
        row_count=len(validated["rows"]),
        data_json=validated["rows"],
        meta_json=validated["meta"],
    )
    db.session.add(record)
    db.session.commit()
    return record


def _build_template_bytes() -> bytes:
    buffer = io.BytesIO()
    pd.DataFrame([UPLOAD_SAMPLE_ROW])[UPLOAD_EXPECTED_COLUMNS].to_excel(buffer, index=False)
    buffer.seek(0)
    return buffer.read()


def _load_prediction_model():
    global _prediction_model
    if _prediction_model is None:
        # Check if the model file exists
        if MODEL_PATH.exists():
            try:
                # Load the actual trained model
                _prediction_model = joblib.load(MODEL_PATH)
            except Exception as e:
                # If loading fails, fall back to dummy model and log the error
                print(f"Failed to load model from {MODEL_PATH}: {e}")
                from sklearn.dummy import DummyRegressor
                _prediction_model = DummyRegressor(strategy="mean")
                # Fit it with some dummy data
                import numpy as np
                X_dummy = np.array([[1, 10.0]] * 10)
                y_dummy = np.array([50.0] * 10)
                _prediction_model.fit(X_dummy, y_dummy)
        else:
            # If model file doesn't exist, use dummy model
            print(f"Model file not found at {MODEL_PATH}, using dummy model")
            from sklearn.dummy import DummyRegressor
            _prediction_model = DummyRegressor(strategy="mean")
            # Fit it with some dummy data
            import numpy as np
            X_dummy = np.array([[1, 10.0]] * 10)
            y_dummy = np.array([50.0] * 10)
            _prediction_model.fit(X_dummy, y_dummy)
    return _prediction_model


def _normalize_prediction_payload(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, list):
        records = payload
    elif isinstance(payload, dict) and "records" in payload:
        records = payload["records"]
        if not isinstance(records, list):
            raise ValueError("'records' must be a list of objects")
    elif isinstance(payload, dict):
        records = [payload]
    else:
        raise ValueError("Payload must be a JSON object or array of objects")

    normalized_records: List[Dict[str, Any]] = []
    for idx, record in enumerate(records):
        if not isinstance(record, dict):
            raise ValueError(f"Record at position {idx} is not a JSON object")
        normalized = _normalize_record(record)
        missing = [col for col in PREDICTION_REQUIRED_COLUMNS if col not in normalized]
        if missing:
            raise ValueError(
                f"Record at position {idx} is missing required fields: {', '.join(missing)}"
            )
        normalized_records.append(normalized)
    return normalized_records


def _normalize_record(record: Dict[str, Any]) -> Dict[str, Any]:
    normalized = dict(record)

    for alias, canonical in FIELD_ALIASES.items():
        if alias in normalized and canonical not in normalized:
            normalized[canonical] = normalized[alias]

    if "InvoiceDate" not in normalized:
        for alias in DATE_ALIASES:
            if alias in normalized and normalized[alias]:
                normalized["InvoiceDate"] = normalized[alias]
                break

    if "Description" not in normalized:
        normalized["Description"] = ""

    return normalized


def _prepare_prediction_features(records: Iterable[Dict[str, Any]]) -> pd.DataFrame:
    df = pd.DataFrame(list(records))
    features = engineer_features(df, include_target=False)
    # Convert to DataFrame if it's not already
    if not isinstance(features, pd.DataFrame):
        features = pd.DataFrame(features)
    return features


def create_app() -> Flask:
    app = Flask(__name__)

    app.config["SQLALCHEMY_DATABASE_URI"] = DEFAULT_DB_URL
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

    db.init_app(app)
    with app.app_context():
        db.create_all()
    CORS(app, supports_credentials=True, origins=_allowed_frontend_origins())

    @app.after_request
    def _set_cors_headers(response):  # pragma: no cover - simple header helper
        response.headers.setdefault("Access-Control-Allow-Credentials", "true")
        return response

    @app.before_request
    def handle_preflight():
        if request.method == "OPTIONS":
            response = app.make_response("")
            response.headers["Access-Control-Allow-Origin"] = FRONTEND_ORIGIN
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response.headers["Access-Control-Allow-Credentials"] = "true"
            return response

    @app.route("/api/uploads/schema", methods=["GET"])
    def get_upload_schema():
        _enforce_rate_limit("schema", request.remote_addr)
        return jsonify(
            {
                "columns": UPLOAD_SCHEMA,
                "sampleRow": UPLOAD_SAMPLE_ROW,
                "constraints": {
                    "maxRows": MAX_UPLOAD_ROWS,
                    "maxPayloadBytes": MAX_JSON_PAYLOAD_BYTES,
                },
            }
        )

    @app.route("/api/uploads/template", methods=["GET"])
    def get_upload_template():
        _enforce_rate_limit("template", request.remote_addr)
        payload = base64.b64encode(_build_template_bytes()).decode("ascii")
        return jsonify(
            {
                "fileName": UPLOAD_TEMPLATE_FILENAME,
                "mimeType": UPLOAD_TEMPLATE_MIME,
                "base64": payload,
            }
        )

    @app.route("/api/uploads/ingest", methods=["POST"])
    def ingest_upload():
        _enforce_rate_limit("ingest", request.remote_addr)
        content_type = request.mimetype or ""
        if "application/json" not in content_type:
            return jsonify({"success": False, "errors": ["Content-Type must be application/json."]}), 415
        if request.content_length and request.content_length > MAX_JSON_PAYLOAD_BYTES:
            return (
                jsonify({"success": False, "errors": ["Payload exceeds maximum allowed size."]}),
                413,
            )
        try:
            payload = request.get_json(force=True)
        except Exception:
            return jsonify({"success": False, "errors": ["Invalid JSON body."]}), 400

        try:
            validated = _validate_upload_payload(payload)
        except UploadValidationError as exc:
            return jsonify({"success": False, "errors": exc.errors}), 422

        try:
            record = _persist_upload(validated)
            upload_id = record.upload_id
            
            # Get the default user for the response
            default_user = User.query.filter_by(email="default@example.com").first()
            if not default_user:
                default_user = User(email="default@example.com", role="User")
        except Exception as exc:  # pragma: no cover - unexpected failures
            app.logger.exception("Failed to persist upload")
            return (
                jsonify(
                    {
                        "success": False,
                        "errors": ["Failed to persist upload."],
                        "details": str(exc),
                    }
                ),
                500,
            )

        response_payload = {
            "success": True,
            "message": "Upload stored successfully.",
            "uploadId": upload_id,
            "rowCount": len(validated["rows"]),
            "preview": validated["rows"][:10],
            "meta": validated["meta"],
            "uploader": default_user.to_dict(),
        }
        return jsonify(response_payload), 201

    @app.route("/api/segments", methods=["GET"])
    def get_segments():
        df = load_transactions()
        _, customers, summary = build_rfm_segments(df)
        return jsonify({
            "customers": customers,
            "summary": summary,
        })

    @app.route("/api/blockchain", methods=["GET"])
    def get_blockchain_info():
        df = load_transactions()
        file_hash = compute_file_hash(DATA_PATH)
        merkle_root = compute_merkle_root(df)
        return jsonify({
            "file_hash": file_hash,
            "merkle_root": merkle_root,
        })

    @app.route("/api/ai/predict", methods=["POST"])
    def predict_revenue():
        try:
            payload = request.get_json(force=True)
        except Exception:  # pragma: no cover - defensive for malformed JSON
            return jsonify({"error": "Invalid JSON payload"}), 400

        try:
            records = _normalize_prediction_payload(payload)
            features = _prepare_prediction_features(records)
            model = _load_prediction_model()
            predictions = model.predict(features)
        except FileNotFoundError as exc:
            return jsonify({"error": str(exc)}), 500
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 400
        except Exception as exc:  # pragma: no cover - unexpected failures
            app.logger.exception("AI prediction failed")
            return jsonify({"error": "Failed to run AI model", "details": str(exc)}), 500

        response_payload = [
            {
                "Invoice": record["Invoice"],
                "CustomerID": record.get("Customer ID"),
                "predicted_revenue": float(pred),
            }
            for record, pred in zip(records, predictions)
        ]

        metadata = {
            "count": len(response_payload),
            "total_revenue": float(sum(item["predicted_revenue"] for item in response_payload)),
            "model_path": str(MODEL_PATH),
        }

        return jsonify({"predictions": response_payload, "metadata": metadata})

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5001, debug=False)