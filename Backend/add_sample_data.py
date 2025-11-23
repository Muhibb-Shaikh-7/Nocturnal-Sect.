"""Script to add sample data to the database for testing purposes."""

import sys
import os
from datetime import datetime, timedelta
from pathlib import Path

# Add the parent directory to the path so we can import app
sys.path.append(str(Path(__file__).parent))

from app import app, db, User, UploadRecord
import json

def add_sample_data():
    """Add sample data to the database."""
    with app.app_context():
        # Create a default user if one doesn't exist
        default_user = User.query.filter_by(email="default@example.com").first()
        if not default_user:
            default_user = User(email="default@example.com", role="User")
            db.session.add(default_user)
            db.session.flush()  # Get the user ID without committing
        
        # Sample data
        sample_data = [
            {
                "Invoice": 123456,
                "CustomerID": 7890,
                "CustomerName": "Ada Lovelace",
                "Amount": 1250.75,
                "Currency": "USD",
                "InvoiceDate": (datetime.utcnow() - timedelta(days=5)).date().isoformat(),
                "Status": "Paid",
            },
            {
                "Invoice": 123457,
                "CustomerID": 7891,
                "CustomerName": "Alan Turing",
                "Amount": 890.50,
                "Currency": "USD",
                "InvoiceDate": (datetime.utcnow() - timedelta(days=10)).date().isoformat(),
                "Status": "Paid",
            },
            {
                "Invoice": 123458,
                "CustomerID": 7892,
                "CustomerName": "Grace Hopper",
                "Amount": 2100.00,
                "Currency": "USD",
                "InvoiceDate": (datetime.utcnow() - timedelta(days=2)).date().isoformat(),
                "Status": "Pending",
            },
            {
                "Invoice": 123459,
                "CustomerID": 7890,
                "CustomerName": "Ada Lovelace",
                "Amount": 650.25,
                "Currency": "USD",
                "InvoiceDate": (datetime.utcnow() - timedelta(days=15)).date().isoformat(),
                "Status": "Paid",
            },
            {
                "Invoice": 123460,
                "CustomerID": 7893,
                "CustomerName": "John von Neumann",
                "Amount": 3200.00,
                "Currency": "USD",
                "InvoiceDate": (datetime.utcnow() - timedelta(days=1)).date().isoformat(),
                "Status": "Paid",
            }
        ]
        
        # Create an upload record with the sample data
        upload_record = UploadRecord(
            upload_id="sample_upload_1",
            user_id=default_user.id,
            original_filename="sample_data.xlsx",
            uploaded_at=datetime.utcnow(),
            row_count=len(sample_data),
            data_json=sample_data,
            meta_json={
                "originalFilename": "sample_data.xlsx",
                "uploadTime": datetime.utcnow().isoformat(),
                "warnings": [],
                "serverReceivedAt": datetime.utcnow().isoformat(),
                "rowCount": len(sample_data),
            }
        )
        
        db.session.add(upload_record)
        db.session.commit()
        
        print("Sample data added successfully!")

if __name__ == "__main__":
    add_sample_data()