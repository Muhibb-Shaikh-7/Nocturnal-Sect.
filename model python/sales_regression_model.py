"""Sales revenue prediction using a RandomForestRegressor.

This module loads the Online Retail II dataset, performs preprocessing, trains a
Random Forest model, evaluates it, and persists the trained pipeline so that it
can be reused (e.g. by the accompanying Flask API).
"""
from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Tuple, Union

import joblib
import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import RandomForestRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

# --------------------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------------------
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

CATEGORICAL_FEATURES = [
    "Invoice",
    "StockCode",
    "Description",
    "Customer ID",
    "Country",
]

TARGET_COLUMN = "Revenue"
DEFAULT_MODEL_PATH = Path("artifacts/sales_random_forest.joblib")
DEFAULT_METRICS_PATH = Path("artifacts/training_metrics.json")


@dataclass
class TrainingArtifacts:
    """Container for paths produced by the training run."""

    model_path: Path
    metrics_path: Path


# --------------------------------------------------------------------------------------
# Data utilities
# --------------------------------------------------------------------------------------
def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Train a RandomForestRegressor to predict revenue per invoice line."
    )
    parser.add_argument(
        "--data-path",
        type=Path,
        required=True,
        help="Path to the Online Retail II CSV file (e.g. online_retail_II.csv).",
    )
    parser.add_argument(
        "--model-output",
        type=Path,
        default=DEFAULT_MODEL_PATH,
        help=f"Where to save the trained pipeline. Defaults to {DEFAULT_MODEL_PATH}.",
    )
    parser.add_argument(
        "--metrics-output",
        type=Path,
        default=DEFAULT_METRICS_PATH,
        help=f"Where to save evaluation metrics JSON. Defaults to {DEFAULT_METRICS_PATH}.",
    )
    parser.add_argument(
        "--test-size",
        type=float,
        default=0.2,
        help="Hold-out size for evaluation. Use 0.2 for an 80/20 split.",
    )
    parser.add_argument(
        "--random-state",
        type=int,
        default=7,
        help="Random state for reproducible splits and model training.",
    )
    parser.add_argument(
        "--n-estimators",
        type=int,
        default=300,
        help="Number of trees for the RandomForestRegressor.",
    )
    parser.add_argument(
        "--max-depth",
        type=int,
        default=None,
        help="Optional maximum depth for the RandomForestRegressor trees.",
    )
    return parser.parse_args()


def load_dataset(csv_path: Path) -> pd.DataFrame:
    if not csv_path.exists():
        raise FileNotFoundError(f"Dataset not found at {csv_path}")
    print(f"Loading dataset from {csv_path} ...")
    return pd.read_csv(csv_path)


def engineer_features(
    df: pd.DataFrame, *, include_target: bool = True
) -> Union[Tuple[pd.DataFrame, pd.Series], pd.DataFrame]:
    data = df.copy()

    # Clean numeric columns we rely on for the target.
    data["Quantity"] = pd.to_numeric(data["Quantity"], errors="coerce")
    data["Price"] = pd.to_numeric(data["Price"], errors="coerce")

    # Convert invoice date to datetime and derive calendar/time features.
    data["InvoiceDate"] = pd.to_datetime(data["InvoiceDate"], errors="coerce")
    data["InvoiceYear"] = data["InvoiceDate"].dt.year
    data["InvoiceMonth"] = data["InvoiceDate"].dt.month
    data["InvoiceDay"] = data["InvoiceDate"].dt.day
    data["InvoiceHour"] = data["InvoiceDate"].dt.hour
    data["InvoiceDayOfWeek"] = data["InvoiceDate"].dt.dayofweek
    data["InvoiceIsWeekend"] = (
        (data["InvoiceDate"].dt.dayofweek >= 5).astype(float)
    )

    # Target variable: line-item revenue.
    data[TARGET_COLUMN] = data["Quantity"] * data["Price"]

    # Remove rows where we cannot compute revenue during supervised training.
    if include_target:
        data = data.dropna(subset=[TARGET_COLUMN])

    # Drop columns we no longer need.
    if "InvoiceDate" in data.columns:
        data = data.drop(columns=["InvoiceDate"])

    features = data[NUMERIC_FEATURES + CATEGORICAL_FEATURES]

    if include_target:
        target = data[TARGET_COLUMN]
        return features, target

    return features


def build_pipeline(args: argparse.Namespace) -> Pipeline:
    numeric_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            (
                "scaler",
                StandardScaler(),  # helps stabilize feature distributions
            ),
        ]
    )

    categorical_transformer = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="most_frequent")),
            (
                "encoder",
                OneHotEncoder(handle_unknown="ignore", sparse_output=True),
            ),
        ]
    )

    preprocessor = ColumnTransformer(
        transformers=[
            ("num", numeric_transformer, NUMERIC_FEATURES),
            ("cat", categorical_transformer, CATEGORICAL_FEATURES),
        ]
    )

    regressor = RandomForestRegressor(
        n_estimators=args.n_estimators,
        max_depth=args.max_depth,
        random_state=args.random_state,
        n_jobs=-1,
    )

    return Pipeline(
        steps=[
            ("preprocessor", preprocessor),
            ("regressor", regressor),
        ]
    )


def evaluate(model: Pipeline, X_test: pd.DataFrame, y_test: pd.Series) -> Dict[str, float]:
    predictions = model.predict(X_test)
    metrics = {
        "mae": mean_absolute_error(y_test, predictions),
        "rmse": mean_squared_error(y_test, predictions, squared=False),
        "r2": r2_score(y_test, predictions),
    }
    print("\nEvaluation metrics (hold-out set):")
    for metric, value in metrics.items():
        print(f"  {metric.upper():<4}: {value:.4f}")
    return metrics


def save_artifacts(model: Pipeline, metrics: Dict[str, float], artifacts: TrainingArtifacts) -> None:
    artifacts.model_path.parent.mkdir(parents=True, exist_ok=True)
    artifacts.metrics_path.parent.mkdir(parents=True, exist_ok=True)

    print(f"\nSaving trained model to {artifacts.model_path} ...")
    joblib.dump(model, artifacts.model_path)

    print(f"Saving metrics to {artifacts.metrics_path} ...")
    artifacts.metrics_path.write_text(json.dumps(metrics, indent=2))


def main() -> None:
    args = parse_args()

    dataset = load_dataset(args.data_path)
    X, y = engineer_features(dataset)

    X_train, X_test, y_train, y_test = train_test_split(
        X,
        y,
        test_size=args.test_size,
        random_state=args.random_state,
    )

    print(
        f"Training samples: {len(X_train):,} | Test samples: {len(X_test):,} (test_size={args.test_size})"
    )

    model = build_pipeline(args)
    print("Fitting RandomForestRegressor ...")
    model.fit(X_train, y_train)

    metrics = evaluate(model, X_test, y_test)
    save_artifacts(
        model,
        metrics,
        TrainingArtifacts(model_path=args.model_output, metrics_path=args.metrics_output),
    )

    print("\nTraining complete. Model ready for inference.")


if __name__ == "__main__":
    main()
