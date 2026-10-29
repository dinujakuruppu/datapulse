
import pandas as pd

# Load CSV dataset
df = pd.read_csv("data/sample.csv")

# Basic data analysis
total_rows = len(df)
total_columns = len(df.columns)
missing_values = df.isnull().sum().sum()
duplicate_rows = df.duplicated().sum()

# Validate email addresses
emails = df["email"].astype("string").str.strip()

invalid_emails = (
    emails.notna()
    & ~emails.str.fullmatch(
        r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
        na=False
    )
)

# Validate age values
ages = pd.to_numeric(df["age"], errors="coerce")

invalid_ages = (
    df["age"].notna()
    & (
        ages.isna()
        | (ages < 0)
        | (ages > 120)
        | (ages % 1 != 0)
    )
)

# Validate dates (YYYY-MM-DD)
dates = pd.to_datetime(
    df["joined_date"],
    format="%Y-%m-%d",
    errors="coerce"
)

invalid_dates = (
    df["joined_date"].notna()
    & dates.isna()
)

# Generate quality report
print("\n=== DataPulse Quality Report ===")

print("Total Rows:", total_rows)
print("Total Columns:", total_columns)
print("Missing Values:", missing_values)
print("Duplicate Rows:", duplicate_rows)

print("\n=== Invalid Data Detection ===")

print("Invalid Emails:", invalid_emails.sum())
print("Invalid Ages:", invalid_ages.sum())
print("Invalid Dates:", invalid_dates.sum())

print("\n=== Missing Values by Column ===")
print(df.isnull().sum())

# Display records containing invalid data
invalid_records = df[
    invalid_emails | invalid_ages | invalid_dates
]

print("\n=== Invalid Records ===")
print(invalid_records)


# =====================================
# DataPulse - Data Quality Score
# =====================================

# Identify rows containing missing values
missing_row_mask = df.isnull().any(axis=1)

# Identify duplicate rows
duplicate_row_mask = df.duplicated(keep="first")

# Identify rows containing invalid formats
invalid_row_mask = (
    invalid_emails |
    invalid_ages |
    invalid_dates
)

# Combine all detected issues
problem_rows = (
    missing_row_mask |
    duplicate_row_mask |
    invalid_row_mask
)

# Calculate the score
valid_rows = int((~problem_rows).sum())
total_problem_rows = int(problem_rows.sum())

quality_score = (
    round((valid_rows / total_rows) * 100, 2)
    if total_rows > 0 else 0.0
)

# Display quality report
print("\n=== DataPulse Quality Score ===")
print("Total Rows:", total_rows)
print("Valid Rows:", valid_rows)
print("Rows With Issues:", total_problem_rows)
print(f"Quality Score: {quality_score:.2f}%")

# Quality classification
if total_rows == 0:
    quality_status = "No Data"
elif quality_score >= 90:
    quality_status = "Excellent"
elif quality_score >= 70:
    quality_status = "Good"
elif quality_score >= 50:
    quality_status = "Needs Improvement"
else:
    quality_status = "Poor"

print("Quality Status:", quality_status)

