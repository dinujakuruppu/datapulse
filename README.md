# DataPulse

**DataPulse** is a CSV data quality analytics application that helps users identify missing values, duplicate rows, and invalid data formats, visualize dataset quality, and download actionable reports. It combines a **FastAPI + Pandas** analysis service with a **Next.js + TypeScript** dashboard.

> **Project status:** Local application implemented and tested with a sample dataset. Render and Vercel deployment instructions are provided below; a live production deployment is not assumed.

## Features

- **CSV upload and analysis** — upload `.csv` files up to **5 MB**.
- **Dataset overview** — row and column counts, valid rows, and rows with issues.
- **Missing data detection** — total missing cells and missing counts by column.
- **Duplicate detection** — repeated rows, retaining the first occurrence as the original.
- **Format validation** — checks the `email`, `age`, and `joined_date` columns when present.
- **Data Quality Score** — a simple percentage of rows without detected issues.
- **Interactive visualizations** — pie chart of valid/problematic rows and bar chart of issue categories using Recharts.
- **Detailed error report** — CSV line number, column, issue type, value, and explanation; includes search and issue-type filters.
- **Downloadable reports** — export results as CSV or JSON from the browser.
- **Interactive API documentation** — automatically available through FastAPI's Swagger UI.

## Tech Stack

| Layer | Technologies |
| --- | --- |
| Frontend | Next.js (App Router), React, TypeScript, Tailwind CSS, Recharts |
| Backend | Python, FastAPI, Uvicorn, Pandas |
| API | REST (`multipart/form-data` upload; JSON response) |
| Deployment | Render (backend) and Vercel (frontend) — planned setup |
| Version control | Git and GitHub |

## Project Structure

```text
datapulse/
├── backend/
│   └── main.py             # FastAPI routes, CSV validation and quality reports
├── data/
│   └── sample.csv          # Test dataset
├── frontend/
│   ├── app/
│   │   ├── page.tsx        # Dashboard, charts, errors and downloads
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── package.json
│   └── package-lock.json
├── analyzer.py             # Command-line CSV quality analyzer
├── requirements.txt        # Python dependencies
├── .python-version         # Python runtime version for hosting
├── .gitignore
└── README.md
```

> Local `.venv/`, `frontend/node_modules/`, and `frontend/.next/` folders are generated during setup and should not be committed.

## Prerequisites

- Python **3.11** recommended for deployment (the development environment used Python 3.9).
- Node.js **20.9+** and npm.
- Git.

## Run Locally

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/datapulse.git
cd datapulse
```

Replace `YOUR_USERNAME` with the GitHub repository owner.

### 2. Set up the Python backend

On macOS or Linux:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python -m uvicorn backend.main:app --reload
```

Backend URLs:

- API health endpoint: http://127.0.0.1:8000/
- Swagger UI: http://127.0.0.1:8000/docs

Leave this terminal running.

### 3. Run the Next.js frontend

Open **another terminal**:

```bash
cd datapulse/frontend  # from the parent directory of datapulse
npm install
npm run dev
```

If you are already at the `datapulse` project root, use `cd frontend` instead of `cd datapulse/frontend`.

Open **http://localhost:3000**.

For local development, the dashboard uses `http://127.0.0.1:8000` as the default API URL. You can override it by creating `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

Restart the Next.js development server after changing environment variables. Do not commit `.env.local`.

## How to Use

1. Start both the FastAPI backend and Next.js frontend.
2. Open the dashboard at `http://localhost:3000`.
3. Select a `.csv` file (maximum 5 MB).
4. Click **Analyze Dataset**.
5. Inspect the summary statistics, quality score, charts and detailed error table.
6. Use search and filters to investigate issues.
7. Click **Download CSV** or **Download JSON** to save the analysis report.

## Validation Rules

| Check | Rule |
| --- | --- |
| Missing values | Empty cells interpreted as missing values by Pandas |
| Duplicate rows | Entire repeated rows; the first matching row is not counted as a duplicate |
| `email` | Basic email format validation (e.g. `person@example.com`) |
| `age` | Integer between 0 and 120, inclusive |
| `joined_date` | Valid date in `YYYY-MM-DD` format |

Format checks only apply when the corresponding column name (`email`, `age`, `joined_date`) exists. These rules are intentionally simple and may need to be customized for real datasets. The basic email check is not proof that an address exists.

### Data Quality Score

DataPulse uses a **row-based score**:

```text
Quality Score (%) = (Rows Without Detected Issues / Total Rows) × 100
```

A row is counted as problematic if it contains at least one missing value, is a duplicate, or fails a supported format check. Multiple errors in one row count as **one problematic row** for the score. For an empty dataset, the score is `0` and status is `No Data`.

| Score | Status |
| --- | --- |
| 90–100% | Excellent |
| 70–<90% | Good |
| 50–<70% | Needs Improvement |
| Below 50% | Poor |

These thresholds are project-defined, **not** a universal data-quality standard.

## API Reference

### `GET /`

Checks whether the backend is running.

Example response:

```json
{
  "message": "DataPulse API is running",
  "status": "success"
}
```

### `POST /analyze`

Upload a CSV dataset using a multipart form field named `file`.

```bash
curl -X POST "http://127.0.0.1:8000/analyze" \
  -F "file=@data/sample.csv"
```

Example of the key results for the included test dataset:

```json
{
  "filename": "sample.csv",
  "total_rows": 4,
  "total_columns": 5,
  "missing_values": 1,
  "duplicate_rows": 1,
  "invalid_emails": 2,
  "invalid_ages": 2,
  "invalid_dates": 2,
  "valid_rows": 1,
  "rows_with_issues": 3,
  "quality_score": 25.0,
  "quality_status": "Poor",
  "total_errors": 8,
  "errors_truncated": false
}
```

The full response also includes `missing_by_column` and an `errors` array. Each error identifies a CSV line number, column, issue type, value, and message. Reported line numbers include the header row.

**API limitations:** The server rejects files larger than 5 MB. The detailed `errors` list is capped at **500** entries; `total_errors` counts all detected issues and `errors_truncated` indicates whether some details were omitted. A `400` response is returned for unsupported or invalid CSV inputs, and `413` for oversized uploads.

## Deployment

The application has two separately deployed services. Deploy the **backend first** and then configure the frontend to use its public URL.

### A. Render — FastAPI Backend

1. Push the repository to GitHub.
2. In [Render](https://dashboard.render.com/), create a **Web Service** from the repository.
3. Choose the production branch (for example, `main`) and Python runtime.
4. Leave the **Root Directory** at the repository root.
5. Configure:

   | Setting | Value |
   | --- | --- |
   | Build command | `pip install -r requirements.txt` |
   | Start command | `uvicorn backend.main:app --host 0.0.0.0 --port $PORT` |
   | Python version | `3.11` via `.python-version`, if supported by the selected runtime |

6. Deploy and verify `https://YOUR-RENDER-URL/` and `https://YOUR-RENDER-URL/docs`.
7. When you know the Vercel production domain, set the Render environment variable `FRONTEND_URL` to that full HTTPS origin (no trailing slash) and redeploy or restart.

**CORS requirement:** `backend/main.py` must configure `CORSMiddleware` to allow `http://localhost:3000`, `http://127.0.0.1:3000`, and the origin read from `FRONTEND_URL`. Add this before publishing if the backend still allows localhost only.

### B. Vercel — Next.js Frontend

1. In [Vercel](https://vercel.com/new), import the same GitHub repository.
2. Select **Next.js** and set the **Root Directory** to `frontend` (**not** `./`).
3. Keep the default Next.js build and install commands.
4. Add the environment variable:

   ```dotenv
   NEXT_PUBLIC_API_URL=https://YOUR-RENDER-URL
   ```

   Do not append `/analyze`; the frontend adds that path.

5. Deploy the frontend.
6. Update Render's `FRONTEND_URL` with the actual Vercel production origin; then test a complete CSV upload from the live site.

Environment variables changed after deployment require a new deployment (or service restart/redeploy as applicable). Vercel preview domains may need additional allowed origins during development.

## Testing Checklist

- [ ] `GET /` returns `status: success`.
- [ ] Uploading `data/sample.csv` returns HTTP 200.
- [ ] The sample reports 4 rows, 1 missing cell and 1 duplicate row.
- [ ] The sample reports 2 invalid emails, 2 invalid ages and 2 invalid dates.
- [ ] The sample quality score is **25%**.
- [ ] Pie and bar charts display and show details on hover.
- [ ] The detailed error report supports search and type filters.
- [ ] CSV and JSON download buttons produce readable files.
- [ ] Oversized, empty and malformed file uploads are rejected appropriately.
- [ ] Production frontend successfully calls the deployed backend.

## Security and Limitations

- **Do not upload sensitive or confidential datasets** to a public demo. The API currently has no authentication or per-user authorization.
- Uploaded CSV contents are processed to produce a response; the current code does **not** implement a persistent database or upload storage.
- The backend must be protected with authentication, rate limiting, monitoring, and appropriate resource limits before production use with untrusted users.
- Only UTF-8-compatible CSV content and the three named format-validation columns are covered by the basic implementation; schema-specific validation can be added later.
- Quality categories can overlap: `total_errors` may exceed `rows_with_issues`.
- When more than 500 issues are detected, detailed CSV/JSON exports contain only the returned error details; summary counts still reflect the full analyzed dataset.

## Suggested Conventional Commits

```text
chore: initialize project configuration
feat(analysis): implement CSV data quality validation
feat(api): implement CSV analysis REST API
feat(dashboard): add interactive charts and report downloads
fix(api): configure production CORS origins
docs: add project documentation and deployment guide
```

## Future Improvements

- Configurable validation rules for arbitrary dataset columns
- Automated backend and frontend tests
- Authentication, rate limiting and secure file handling
- Report history with a database
- Pagination and export of all error records
- Support for larger datasets and streaming analysis

---

**DataPulse** — Turn CSV data issues into actionable quality insights.

