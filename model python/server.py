"""Flask API for serving the trained sales revenue prediction model."""
from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any, Dict, Iterable, List

import joblib
import pandas as pd
from flask import Flask, jsonify, request

from sales_regression_model import (
    DEFAULT_MODEL_PATH,
    CATEGORICAL_FEATURES,
    NUMERIC_FEATURES,
    engineer_features,
)

app = Flask(__name__)

MODEL_PATH = Path(os.getenv("MODEL_PATH", DEFAULT_MODEL_PATH))
REQUIRED_COLUMNS = [
    "Invoice",
    "StockCode",
    "Description",
    "Quantity",
    "InvoiceDate",
    "Price",
    "Customer ID",
    "Country",
]

_model = None


def load_trained_model() -> Any:
    global _model
    if _model is None:
        if not MODEL_PATH.exists():
            raise FileNotFoundError(
                f"Model file not found at {MODEL_PATH}. Train the model first by running sales_regression_model.py."
            )
        app.logger.info("Loading model from %s", MODEL_PATH)
        _model = joblib.load(MODEL_PATH)
    return _model


def _normalize_payload(payload: Any) -> List[Dict[str, Any]]:
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict) and "records" in payload:
        records = payload["records"]
        if not isinstance(records, list):
            raise ValueError("'records' must be a list of dictionaries.")
        return records
    if isinstance(payload, dict):
        return [payload]
    raise ValueError("Payload must be a JSON object or array of objects.")


def _validate_records(records: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    validated = []
    for idx, record in enumerate(records):
        if not isinstance(record, dict):
            raise ValueError(f"Record at position {idx} is not a JSON object.")
        missing = [col for col in REQUIRED_COLUMNS if col not in record]
        if missing:
            raise ValueError(
                f"Record at position {idx} is missing required fields: {', '.join(missing)}"
            )
        validated.append(record)
    return validated


def _prepare_features(records: List[Dict[str, Any]]) -> pd.DataFrame:
    df = pd.DataFrame(records)
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


@app.route("/health", methods=["GET"])
def health() -> Any:
    return jsonify({"status": "ok", "model_path": str(MODEL_PATH)})


@app.route("/predict", methods=["POST"])
def predict() -> Any:
    try:
        payload = request.get_json(force=True)
        records = _normalize_payload(payload)
        validated_records = _validate_records(records)
        features = _prepare_features(validated_records)

        model = load_trained_model()
        predictions = model.predict(features)

        response_payload = [
            {
                "Invoice": record["Invoice"],
                "predicted_revenue": float(pred),
            }
            for record, pred in zip(validated_records, predictions)
        ]

        return jsonify(
            {
                "predictions": response_payload,
                "metadata": {
                    "num_predictions": len(response_payload),
                    "required_features": REQUIRED_COLUMNS,
                    "feature_columns": NUMERIC_FEATURES + CATEGORICAL_FEATURES,
                },
            }
        )
    except Exception as exc:  # broad exception turned into JSON response for API clients
        app.logger.exception("Prediction failed")
        return (
            jsonify(
                {
                    "error": str(exc),
                    "hint": "Ensure your JSON payload matches the required schema.",
                }
            ),
            400,
        )


if __name__ == "__main__":
    load_trained_model()
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)), debug=False)
