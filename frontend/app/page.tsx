
"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";

type DataError = {
  row: number;
  column: string;
  type: string;
  value: string;
  message: string;
};

type Report = {
  filename: string;
  total_rows: number;
  total_columns: number;
  missing_values: number;
  duplicate_rows: number;
  invalid_emails: number;
  invalid_ages: number;
  invalid_dates: number;
  missing_by_column: Record<string, number>;
  valid_rows: number;
  rows_with_issues: number;
  quality_score: number;
  quality_status: string;
  total_errors: number;
  errors_truncated: boolean;
  errors: DataError[];
};

const PIE_COLORS = ["#10b981", "#f97316"];

function downloadFile(
  content: string,
  filename: string,
  contentType: string
) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Escape CSV and prevent spreadsheet formula injection
function csvCell(value: string | number) {
  let text = String(value);

  if (/^\s*[=+\-@\t\r]/.test(text)) {
    text = "'" + text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  async function analyzeDataset() {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError("Maximum CSV file size is 5 MB.");
      return;
    }

    setLoading(true);
    setError("");
    setReport(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL ||
        "http://127.0.0.1:8000";

      const response = await fetch(`${apiUrl}/analyze`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let message = `Analysis failed (${response.status})`;

        try {
          const data = await response.json();
          if (typeof data.detail === "string") {
            message = data.detail;
          }
        } catch {
          // Use the HTTP status message
        }

        throw new Error(message);
      }

      const data: Report = await response.json();
      setReport(data);
      setSearch("");
      setFilter("all");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to connect to the backend."
      );
    } finally {
      setLoading(false);
    }
  }

  function downloadJSON() {
    if (!report) return;

    const name = safeFilename(report.filename);

    downloadFile(
      JSON.stringify(report, null, 2),
      `${name}-quality-report.json`,
      "application/json"
    );
  }

  function safeFilename(filename: string) {
    return filename
      .replace(/\.csv$/i, "")
      .replace(/[^a-zA-Z0-9_-]/g, "_");
  }

  function downloadCSV() {
    if (!report) return;

    const rows: (string | number)[][] = [
      ["Metric", "Value"],
      ["Dataset", report.filename],
      ["Total Rows", report.total_rows],
      ["Total Columns", report.total_columns],
      ["Missing Values", report.missing_values],
      ["Duplicate Rows", report.duplicate_rows],
      ["Invalid Emails", report.invalid_emails],
      ["Invalid Ages", report.invalid_ages],
      ["Invalid Dates", report.invalid_dates],
      ["Valid Rows", report.valid_rows],
      ["Rows With Issues", report.rows_with_issues],
      ["Quality Score", report.quality_score],
      ["Quality Status", report.quality_status],
      ["Total Errors", report.total_errors],
      ["Error Details Truncated", String(report.errors_truncated)],
      [],
      ["Row", "Column", "Type", "Value", "Message"],
      ...report.errors.map((item) => [
        item.row,
        item.column,
        item.type,
        item.value,
        item.message,
      ]),
    ];

    const csv = rows
      .map((row) => row.map(csvCell).join(","))
      .join("\r\n");

    downloadFile(
      "\uFEFF" + csv,
      `${safeFilename(report.filename)}-quality-report.csv`,
      "text/csv;charset=utf-8"
    );
  }

  const pieData = report
    ? [
        { name: "Valid Rows", value: report.valid_rows },
        {
          name: "Rows With Issues",
          value: report.rows_with_issues,
        },
      ]
    : [];

  const barData = report
    ? [
        { name: "Missing", count: report.missing_values },
        { name: "Duplicate", count: report.duplicate_rows },
        { name: "Email", count: report.invalid_emails },
        { name: "Age", count: report.invalid_ages },
        { name: "Date", count: report.invalid_dates },
      ]
    : [];

  const filteredErrors = report
    ? report.errors.filter((item) => {
        const matchesType =
          filter === "all" || item.type === filter;

        const query = search.toLowerCase();

        const matchesSearch =
          String(item.row).includes(query) ||
          item.column.toLowerCase().includes(query) ||
          item.value.toLowerCase().includes(query) ||
          item.message.toLowerCase().includes(query);

        return matchesType && matchesSearch;
      })
    : [];

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-white">
      <div className="mx-auto max-w-6xl space-y-8">
        <header>
          <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-cyan-400">
            Data Quality Analytics
          </p>
          <h1 className="text-4xl font-bold">
            DataPulse
          </h1>
          <p className="mt-3 text-slate-400">
            Analyze CSV datasets, identify quality issues,
            and generate downloadable reports.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="mb-4 text-xl font-semibold">
            Upload Dataset
          </h2>

          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null);
              setReport(null);
              setError("");
            }}
            className="block w-full text-sm text-slate-300"
          />

          <button
            onClick={analyzeDataset}
            disabled={!file || loading}
            className="mt-5 rounded-lg bg-cyan-600 px-6 py-3 font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
          >
            {loading ? "Analyzing..." : "Analyze Dataset"}
          </button>

          {error && (
            <p role="alert" className="mt-4 text-red-400">
              {error}
            </p>
          )}
        </section>

        {report && (
          <>
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold">
                    Analysis Report
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {report.filename}
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={downloadCSV}
                    className="rounded-lg bg-emerald-600 px-4 py-2 font-medium hover:bg-emerald-500"
                  >
                    Download CSV
                  </button>
                  <button
                    onClick={downloadJSON}
                    className="rounded-lg bg-indigo-600 px-4 py-2 font-medium hover:bg-indigo-500"
                  >
                    Download JSON
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {[
                  ["Total Rows", report.total_rows],
                  ["Valid Rows", report.valid_rows],
                  ["Missing Values", report.missing_values],
                  ["Duplicate Rows", report.duplicate_rows],
                  ["Invalid Emails", report.invalid_emails],
                  ["Invalid Ages", report.invalid_ages],
                  ["Invalid Dates", report.invalid_dates],
                  ["Total Errors", report.total_errors],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-xl border border-slate-800 bg-slate-900 p-5"
                  >
                    <p className="text-sm text-slate-400">
                      {label}
                    </p>
                    <p className="mt-2 text-3xl font-bold">
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-semibold">
                Data Quality Score
              </h2>

              <p className="mt-3 text-5xl font-bold">
                {report.quality_score}%
              </p>

              <div className="mt-5 h-4 overflow-hidden rounded-full bg-slate-700">
                <div
                  className="h-full rounded-full bg-cyan-500"
                  style={{
                    width: `${report.quality_score}%`,
                  }}
                />
              </div>

              <p className="mt-3 text-slate-400">
                Quality Status:{" "}
                <span className="font-semibold text-white">
                  {report.quality_status}
                </span>
              </p>
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <h3 className="mb-6 text-lg font-semibold">
                  Valid vs Problematic Rows
                </h3>

                <div className="h-72">
                  {report.total_rows > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={pieData}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={60}
                          outerRadius={95}
                        >
                          {pieData.map((entry, index) => (
                            <Cell
                              key={entry.name}
                              fill={PIE_COLORS[index]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-slate-400">
                      No rows to display.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <h3 className="mb-6 text-lg font-semibold">
                  Data Quality Issues
                </h3>

                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="#334155"
                      />
                      <XAxis
                        dataKey="name"
                        stroke="#94a3b8"
                        tick={{ fontSize: 12 }}
                      />
                      <YAxis
                        stroke="#94a3b8"
                        allowDecimals={false}
                      />
                      <Tooltip />
                      <Bar
                        dataKey="count"
                        fill="#06b6d4"
                        radius={[6, 6, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-xs text-slate-400">
                  Missing counts cells; other categories count rows.
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-bold">
                Detailed Error Report
              </h2>

              <p className="mt-2 text-sm text-slate-400">
                {report.total_errors} issues detected
              </p>

              {report.errors_truncated && (
                <p className="mt-3 text-amber-300">
                  Only the first 500 detected issues are
                  included in this report and its downloads.
                </p>
              )}

              <div className="my-5 flex flex-wrap gap-3">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search row, column or value..."
                  className="min-w-60 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm outline-none focus:border-cyan-500"
                />

                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 text-sm"
                >
                  <option value="all">All Issues</option>
                  <option value="missing">Missing Values</option>
                  <option value="duplicate">Duplicates</option>
                  <option value="invalid_email">Invalid Emails</option>
                  <option value="invalid_age">Invalid Ages</option>
                  <option value="invalid_date">Invalid Dates</option>
                </select>
              </div>

              <div className="max-h-[480px] overflow-auto">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="sticky top-0 bg-slate-800 text-slate-300">
                    <tr>
                      {[
                        "Row",
                        "Column",
                        "Issue Type",
                        "Value",
                        "Description",
                      ].map((heading) => (
                        <th
                          key={heading}
                          className="px-4 py-3 font-semibold"
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredErrors.map((item, index) => (
                      <tr
                        key={`${item.row}-${item.type}-${index}`}
                        className="border-b border-slate-800"
                      >
                        <td className="px-4 py-3">
                          {item.row}
                        </td>
                        <td className="px-4 py-3">
                          {item.column}
                        </td>
                        <td className="px-4 py-3 text-orange-300">
                          {item.type.replaceAll("_", " ")}
                        </td>
                        <td className="max-w-48 break-words px-4 py-3">
                          {item.value || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-400">
                          {item.message}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {filteredErrors.length === 0 && (
                  <p className="py-8 text-center text-slate-400">
                    No matching errors found.
                  </p>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
