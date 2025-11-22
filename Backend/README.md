# Backend Service (Flask + AI Model)

## Overview
This backend powers the CRM analytics dashboard and blockchain integrity tools. It exposes REST endpoints for:

- **Customer segmentation** using on-the-fly RFM calculations.
- **Blockchain-style integrity proofs** (SHA256 + Merkle root) for the transaction dataset.
- **AI revenue predictions** powered by a trained RandomForest regression pipeline (`CrmModel/sales_regression_model.py`).

The service is written in Flask, loads pre-computed model artifacts from `CrmModel/artifacts/`, and is designed to be consumed by the Next.js frontend located in `../frontend`.

## Tech Stack
- Python 3.11+a
- Flask 3
- Flask-CORS 4
- Pandas / NumPy
- scikit-learn + joblib (for the saved model)

## Project Structure
```
Backend/
├── app.py                     # Main Flask application
├── requirements.txt           # Python dependencies
├── data/transactions.csv      # Sample dataset for RFM + blockchain endpoints
└── CrmModel/
    ├── sales_regression_model.py   # Training script + feature engineering utilities
    ├── server.py                   # Standalone prediction API (optional)
    └── artifacts/
        ├── sales_random_forest.joblib  # Trained model pipeline
        └── training_metrics.json       # Training metrics snapshot
```

## Prerequisites
1. **Python**: Install Python 3.11 (matching the version used for model training). Verify with `py -0p`.
2. **Pip**: Ensure `pip` is available for the chosen interpreter (`py -3.11 -m pip ...`).
3. **Model artifact**: `CrmModel/artifacts/sales_random_forest.joblib` must exist. Re-train if missing (see "Training" section).

## Installation
From the `Backend/` directory:
```powershell
py -3.11 -m pip install -r requirements.txt
```
This installs Flask, pandas, scikit-learn, joblib, and supporting libraries.

## Environment Variables
| Variable     | Description                                                                            | Default                                           |
|--------------|----------------------------------------------------------------------------------------|---------------------------------------------------|
| `MODEL_PATH` | Absolute/relative path to the `.joblib` pipeline used by `app.py` for predictions.     | `CrmModel/artifacts/sales_random_forest.joblib`   |

## Running the Server
```powershell
cd Backend
py -3.11 -m flask --app app run --host 127.0.0.1 --port 5050
```
Notes:
- Keep this terminal open so the Flask service remains online.
- The frontend (`../frontend`) expects the backend URL in `NEXT_PUBLIC_API_BASE_URL` (e.g., `http://127.0.0.1:5050`).

## API Reference
| Method | Endpoint            | Description                                                                 |
|--------|---------------------|-----------------------------------------------------------------------------|
| GET    | `/api/segments`     | Computes RFM segments, returning `customers` (detailed records) and `summary` counts/offers.
| GET    | `/api/blockchain`   | Returns `file_hash` (SHA256 of CSV) and `merkle_root` built from transaction rows.
| POST   | `/api/ai/predict`   | Predicts invoice-level revenue using the trained RandomForest pipeline.

### Sample Prediction Request
```powershell
$json = @"
{
  "records": [
    {
      "Invoice": 600005,
      "StockCode": "90010",
      "Description": "AI Smart Speaker",
      "Quantity": 4,
      "InvoiceDate": "2025-11-25 10:00:00",
      "Price": 120,
      "Customer ID": "CUST-0100",
      "Country": "United Kingdom"
    }
  ]
}
"@

Invoke-RestMethod -Uri http://127.0.0.1:5050/api/ai/predict `
  -Method Post -ContentType 'application/json' -Body $json
```
**Response:**
```json
{
  "predictions": [
    {
      "Invoice": 600005,
      "CustomerID": "CUST-0100",
      "predicted_revenue": 480.12
    }
  ],
  "metadata": {
    "count": 1,
    "total_revenue": 480.12,
    "model_path": "c:\\Nocturnal\\Backend\\CrmModel\\artifacts\\sales_random_forest.joblib"
  }
}
```
(The value shown is illustrative; actual output depends on the model artifact.)

## Training / Updating the Model
If you need to retrain:
```powershell
cd Backend/CrmModel
py -3.11 sales_regression_model.py --data-path ..\data\transactions.csv
```
This script:
1. Loads the dataset.
2. Engineers time features (`InvoiceYear`, etc.).
3. Trains a RandomForestRegressor.
4. Saves the pipeline to `artifacts/sales_random_forest.joblib` and metrics to `artifacts/training_metrics.json`.

After retraining, restart the main Flask server so it reloads the updated artifact.

## Frontend Integration Notes
- The Next.js app (in `../frontend`) consumes these endpoints. Set `NEXT_PUBLIC_API_BASE_URL` before running `npm run dev`.
- When both servers run simultaneously, the dashboard surfaces live segment summaries, blockchain hashes, and AI predictions.

## Troubleshooting
| Issue                                      | Fix |
|--------------------------------------------|-----|
| `ModuleNotFoundError: flask` (or similar)  | Re-run `py -3.11 -m pip install -r requirements.txt`.
| `Model file not found` error on `/api/ai/predict` | Train the model or set `MODEL_PATH` to the correct `.joblib`.
| `404` hitting `/api/ai/predict`            | Ensure the Flask server is running from the updated `Backend/` directory (command above). |
| Build-tools error while installing pandas  | Use Python 3.11 wheels (already available) rather than newer interpreter versions that require local compilation. |

## License
See the repository root for licensing information.
