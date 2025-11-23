"""Sales regression model utilities for feature engineering and prediction."""

import pandas as pd
from datetime import datetime
from typing import List, Dict, Any

# Define the feature columns expected by the model
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

ALL_FEATURES = NUMERIC_FEATURES + CATEGORICAL_FEATURES

# Default model path
DEFAULT_MODEL_PATH = "CrmModel/sales_random_forest.joblib"


def engineer_features(df: pd.DataFrame, include_target: bool = False) -> pd.DataFrame:
    """
    Engineer features from transaction data for the sales prediction model.
    
    Args:
        df: DataFrame containing transaction data with columns like Invoice, StockCode, 
            Description, Quantity, InvoiceDate, Price, Customer ID, Country
        include_target: Whether to include the target variable (TotalAmount)
        
    Returns:
        DataFrame with engineered features
    """
    # Make a copy to avoid modifying the original dataframe
    data = df.copy()
    
    # Convert InvoiceDate to datetime if it's not already
    if "InvoiceDate" in data.columns:
        data["InvoiceDate"] = pd.to_datetime(data["InvoiceDate"])
        
        # Extract time-based features
        data["InvoiceYear"] = data["InvoiceDate"].dt.year
        data["InvoiceMonth"] = data["InvoiceDate"].dt.month
        data["InvoiceDay"] = data["InvoiceDate"].dt.day
        data["InvoiceHour"] = data["InvoiceDate"].dt.hour
        data["InvoiceDayOfWeek"] = data["InvoiceDate"].dt.dayofweek
        data["InvoiceIsWeekend"] = data["InvoiceDayOfWeek"].isin([5, 6]).astype(int)
    
    # Calculate TotalAmount if not present and needed
    if include_target and "TotalAmount" not in data.columns:
        if "Quantity" in data.columns and "Price" in data.columns:
            data["TotalAmount"] = data["Quantity"] * data["Price"]
    
    # Select only the features the model expects
    feature_columns = ALL_FEATURES.copy()
    if include_target and "TotalAmount" in data.columns:
        feature_columns.append("TotalAmount")
    
    # Ensure all required columns are present, filling missing ones with default values
    for col in ALL_FEATURES:
        if col not in data.columns:
            if col in NUMERIC_FEATURES:
                data[col] = 0
            else:
                data[col] = "Unknown"
    
    return data[feature_columns]


def prepare_prediction_data(records: List[Dict[str, Any]]) -> pd.DataFrame:
    """
    Prepare data for prediction by applying the same transformations as training data.
    
    Args:
        records: List of transaction records
        
    Returns:
        DataFrame ready for model prediction
    """
    # Convert records to DataFrame
    df = pd.DataFrame(records)
    
    # Apply feature engineering
    features_df = engineer_features(df, include_target=False)
    
    return features_df