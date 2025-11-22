"""Minimal utilities to support revenue predictions from the trained model."""
from __future__ import annotations

from pathlib import Path
from typing import Tuple, Union

import pandas as pd

# Numerical columns engineered from InvoiceDate
NUMERIC_FEATURES = [
    "Quantity",
    "Price",
    "InvoiceYear",
    "InvoiceMonth",
    "InvoiceDay",
    "InvoiceHour",
    "InvoiceDayOfWeek",
    "InvoiceIsWeekend",
]

# Categorical columns consumed by the RandomForest pipeline
CATEGORICAL_FEATURES = [
    "Invoice",
    "StockCode",
    "Description",
    "Customer ID",
    "Country",
]

# Latest trained RandomForest pipeline provided by the user
DEFAULT_MODEL_PATH = Path(__file__).resolve().parent.parent / "sales_random_forestt.joblib"


def engineer_features(
    df: pd.DataFrame, *, include_target: bool = True
) -> Union[Tuple[pd.DataFrame, pd.Series], pd.DataFrame]:
    """Recreate the feature engineering used during model training."""

    data = df.copy()

    # Ensure numeric values
    data["Quantity"] = pd.to_numeric(data.get("Quantity"), errors="coerce")
    data["Price"] = pd.to_numeric(data.get("Price"), errors="coerce")

    # Invoice timestamp derivatives
    data["InvoiceDate"] = pd.to_datetime(data.get("InvoiceDate"), errors="coerce")
    data["InvoiceYear"] = data["InvoiceDate"].dt.year
    data["InvoiceMonth"] = data["InvoiceDate"].dt.month
    data["InvoiceDay"] = data["InvoiceDate"].dt.day
    data["InvoiceHour"] = data["InvoiceDate"].dt.hour
    data["InvoiceDayOfWeek"] = data["InvoiceDate"].dt.dayofweek
    data["InvoiceIsWeekend"] = (data["InvoiceDate"].dt.dayofweek >= 5).astype(float)

    # Target variable used by the RandomForestRegressor
    target = None
    if include_target:
        data["Revenue"] = data["Quantity"] * data["Price"]
        data = data.dropna(subset=["Revenue"])
        target = data["Revenue"]

    # Drop raw datetime column once features are extracted
    if "InvoiceDate" in data.columns:
        data = data.drop(columns=["InvoiceDate"])

    # Ensure all categorical placeholders exist
    for column in CATEGORICAL_FEATURES:
        if column not in data.columns:
            data[column] = ""

    features = data[NUMERIC_FEATURES + CATEGORICAL_FEATURES]

    if include_target:
        return features, target
    return features
