from __future__ import annotations

from datetime import datetime
from pathlib import Path
import hashlib
import os
from typing import Any, Dict, Iterable, List

import joblib
from flask import Flask, jsonify, request
from flask_cors import CORS
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


def load_transactions() -> pd.DataFrame:
    if not DATA_PATH.exists():
        raise FileNotFoundError(f"Transactions file not found at {DATA_PATH}")

    df = pd.read_csv(DATA_PATH)
    if df.empty:
        return df

    if "InvoiceDate" not in df.columns or "CustomerID" not in df.columns:
        raise ValueError("CSV must contain InvoiceDate and CustomerID columns")

    df["InvoiceDate"] = pd.to_datetime(df["InvoiceDate"], errors="coerce")
    df = df.dropna(subset=["InvoiceDate", "CustomerID"])

    if "TotalAmount" not in df.columns:
        df["TotalAmount"] = df.get("Quantity", 0) * df.get("UnitPrice", 0)
    else:
        df["TotalAmount"] = df["TotalAmount"].fillna(
            df.get("Quantity", 0) * df.get("UnitPrice", 0)
        )

    return df


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


def _load_prediction_model():
    global _prediction_model
    if _prediction_model is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                f"Model file not found at {MODEL_PATH}. Use the CrmModel training script first."
            )
        _prediction_model = joblib.load(MODEL_PATH)
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
    missing_columns = [
        col for col in NUMERIC_FEATURES + CATEGORICAL_FEATURES if col not in features.columns
    ]
    if missing_columns:
        raise ValueError(
            "Feature engineering failed to build all required columns: "
            + ", ".join(missing_columns)
        )
    return features


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app)

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
    app.run(host="0.0.0.0", port=5000, debug=False)
