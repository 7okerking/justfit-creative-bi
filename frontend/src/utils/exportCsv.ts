/**
 * 通用 CSV 导出工具
 */

export interface CsvColumn {
  header: string;
  key: string;
  formatter?: (value: any) => string;
}

export function exportCsv(
  columns: CsvColumn[],
  data: Record<string, any>[],
  filename?: string
): void {
  const BOM = "\uFEFF";
  const headerLine = columns.map((c) => escapeCsvField(c.header)).join(",");

  const bodyLines = data.map((row) =>
    columns
      .map((col) => {
        const raw = row[col.key];
        const val = col.formatter ? col.formatter(raw) : String(raw ?? "");
        return escapeCsvField(val);
      })
      .join(",")
  );

  const csvContent = BOM + [headerLine, ...bodyLines].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const ts = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const finalName = filename ?? `export_${ts}.csv`;

  const link = document.createElement("a");
  link.href = url;
  link.download = finalName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
