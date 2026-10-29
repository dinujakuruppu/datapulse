import os
from io import BytesIO

import pandas as pd
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware


app = FastAPI(
    title="DataPulse API",
    version="2.0.0",
    description="CSV Data Quality Analysis API"
)

# Frontend domains allowed to access the API
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

# Production frontend URL from environment variables
production_frontend = os.getenv("FRONTEND_URL", "").rstrip("/")

if production_frontend:
    allowed_origins.append(production_frontend)

# Configure CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)


MAX_FILE_SIZE = 5 * 1024 * 1024
MAX_REPORT_ERRORS = 500


@app.get("/")
def home():
    return {
        "message": "DataPulse API is running",
        "status": "success"
    }


@app.post("/analyze")
async def analyze_csv(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=400,
            detail="Please upload a CSV file."
        )

    content = await file.read(MAX_FILE_SIZE + 1)
    await file.close()

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail="Maximum file size is 5 MB."
        )

    try:
        df = pd.read_csv(BytesIO(content))
    except (
        pd.errors.EmptyDataError,
        pd.errors.ParserError,
        UnicodeDecodeError,
        ValueError
    ):
        raise HTTPException(
            status_code=400,
            detail="Invalid or empty CSV file."
        )

    total_rows = len(df)
    total_columns = len(df.columns)

    missing_values = int(df.isna().sum().sum())
    missing_by_column = {
        col: int(count)
        for col, count in df.isna().sum().items()
    }

    missing_mask = df.isna().any(axis=1)
    duplicate_mask = df.duplicated(keep="first")

    invalid_email_mask = pd.Series(False, index=df.index)
    invalid_age_mask = pd.Series(False, index=df.index)
    invalid_date_mask = pd.Series(False, index=df.index)

    # Email validation
    if "email" in df.columns:
        emails = df["email"].astype("string").str.strip()
        invalid_email_mask = (
            emails.notna()
            & ~emails.str.fullmatch(
                r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
                na=False
            )
        ).fillna(False)

    # Age validation
    if "age" in df.columns:
        ages = pd.to_numeric(df["age"], errors="coerce")
        invalid_age_mask = (
            df["age"].notna()
            & (
                ages.isna()
                | (ages < 0)
                | (ages > 120)
                | (ages % 1 != 0)
            )
        ).fillna(False)

    # Date validation
    if "joined_date" in df.columns:
        dates = pd.to_datetime(
            df["joined_date"],
            format="%Y-%m-%d",
            errors="coerce"
        )
        invalid_date_mask = (
            df["joined_date"].notna()
            & dates.isna()
        ).fillna(False)

    invalid_mask = (
        invalid_email_mask
        | invalid_age_mask
        | invalid_date_mask
    )

    problem_mask = (
        missing_mask
        | duplicate_mask
        | invalid_mask
    )

    valid_rows = int((~problem_mask).sum())
    rows_with_issues = int(problem_mask.sum())

    quality_score = (
        round(valid_rows / total_rows * 100, 2)
        if total_rows > 0 else 0.0
    )

    if total_rows == 0:
        status = "No Data"
    elif quality_score >= 90:
        status = "Excellent"
    elif quality_score >= 70:
        status = "Good"
    elif quality_score >= 50:
        status = "Needs Improvement"
    else:
        status = "Poor"

    # Detailed error report
    errors = []
    total_errors = 0

    def add_error(index, column, issue_type, message):
        nonlocal total_errors
        total_errors += 1

        if len(errors) >= MAX_REPORT_ERRORS:
            return

        value = df.at[index, column] if column in df.columns else None

        errors.append({
            "row": int(index) + 2,
            "column": column,
            "type": issue_type,
            "value": "" if pd.isna(value) else str(value),
            "message": message
        })

    # Detect missing values
    for column in df.columns:
        for index in df.index[df[column].isna()]:
            add_error(
                index, column, "missing",
                "Required value is missing"
            )

    # Detect duplicates
    for index in df.index[duplicate_mask]:
        add_error(
            index, "record", "duplicate",
            "Duplicate of an earlier row"
        )

    # Detect invalid emails
    for index in df.index[invalid_email_mask]:
        add_error(
            index, "email", "invalid_email",
            "Invalid email format"
        )

    # Detect invalid ages
    for index in df.index[invalid_age_mask]:
        add_error(
            index, "age", "invalid_age",
            "Age must be an integer between 0 and 120"
        )

    # Detect invalid dates
    for index in df.index[invalid_date_mask]:
        add_error(
            index, "joined_date", "invalid_date",
            "Invalid date (expected YYYY-MM-DD)"
        )

    errors.sort(key=lambda item: (item["row"], item["column"]))

    return {
        "filename": file.filename,
        "total_rows": total_rows,
        "total_columns": total_columns,
        "missing_values": missing_values,
        "duplicate_rows": int(duplicate_mask.sum()),
        "invalid_emails": int(invalid_email_mask.sum()),
        "invalid_ages": int(invalid_age_mask.sum()),
        "invalid_dates": int(invalid_date_mask.sum()),
        "missing_by_column": missing_by_column,
        "valid_rows": valid_rows,
        "rows_with_issues": rows_with_issues,
        "quality_score": quality_score,
        "quality_status": status,
        "total_errors": total_errors,
        "errors_truncated": total_errors > len(errors),
        "errors": errors
    }
