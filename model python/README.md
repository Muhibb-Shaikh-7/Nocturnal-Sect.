# Random Forest Sales Revenue Predictor

This project trains a RandomForestRegressor on the [Online Retail II dataset](https://archive.ics.uci.edu/ml/datasets/Online+Retail+II) to predict per-line revenue. It contains:

- `sales_regression_model.py`: end-to-end training pipeline with preprocessing, evaluation, and artifact persistence.
- `server.py`: Flask API that loads the trained pipeline and exposes prediction endpoints.
- `requirements.txt`: pinned versions for reproducibility.

## 1. Environment setup

```bash
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -r requirements.txt
```

## 2. Train the model

```bash
python sales_regression_model.py --data-path online_retail_II.csv
```

Artifacts (model + metrics) are written to `artifacts/` by default. Adjust CLI flags such as `--model-output` or `--n-estimators` as needed.

### Training script overview

- Cleans numeric fields and derives calendar features from `InvoiceDate`.
- Encodes categorical columns via `OneHotEncoder` and scales numeric features.
- Splits the data into 80/20 train-test sets.
- Reports MAE, RMSE, and R² on the hold-out set.
- Saves the entire preprocessing + model pipeline via `joblib` to ensure consistent inference.

## 3. Run the Flask API

Make sure the model artifact exists (train first). Then start the server:

```bash
python server.py
```

Environment variables:

- `MODEL_PATH`: optional path to the trained `.joblib` file (defaults to `artifacts/sales_random_forest.joblib`).
- `PORT`: port for the Flask development server (defaults to `5000`).

## 4. Call the API

### Health check

```bash
curl http://localhost:5000/health
```

### Prediction endpoint

Payload must contain the full set of required fields. You can send a single object or `{ "records": [...] }`.

```bash
curl -X POST http://localhost:5000/predict \
  -H "Content-Type: application/json" \
  -d '{
        "Invoice": "537226",
        "StockCode": "85123A",
        "Description": "WHITE HANGING HEART T-LIGHT HOLDER",
        "Quantity": 6,
        "InvoiceDate": "2011-12-09 12:34:00",
        "Price": 2.55,
        "Customer ID": 17850,
        "Country": "United Kingdom"
      }'
```

**Sample response**

```json
{
  "predictions": [
    {
      "Invoice": "537226",
      "predicted_revenue": 14.87
    }
  ],
  "metadata": {
    "num_predictions": 1,
    "required_features": [
      "Invoice",
      "StockCode",
      "Description",
      "Quantity",
      "InvoiceDate",
      "Price",
      "Customer ID",
      "Country"
    ],
    "feature_columns": [
      "Quantity",
      "Price",
      "InvoiceYear",
      "InvoiceMonth",
      "InvoiceDay",
      "InvoiceHour",
      "InvoiceDayOfWeek",
      "InvoiceIsWeekend",
      "Invoice",
      "StockCode",
      "Description",
      "Customer ID",
      "Country"
    ]
  }
}
```

Errors are returned as JSON with helpful hints if required fields are missing or payloads are malformed.

## 5. Reusability tips

- `engineer_features` can be reused during inference by setting `include_target=False` (the server uses this).
- The persisted pipeline already includes preprocessing, so you only need to provide raw columns when predicting.
- Adjust Random Forest hyperparameters via CLI flags for experimentation.

## 6. Project status

- [x] Training pipeline with preprocessing + artifact saving
- [x] Flask inference server with validation helpers
- [x] Requirements + README documentation
