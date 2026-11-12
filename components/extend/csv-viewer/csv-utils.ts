import Papa from "papaparse"

export type CsvSearchResult = {
  col: number
  row: number
  displayValue: string
  columnTitle: string
}

export function toDisplayString(value: unknown): string {
  return value === null || value === undefined ? "" : String(value)
}

export function editedCellToText(value: { data?: unknown }): string {
  const data = value.data
  if (typeof data === "string") return data
  if (typeof data === "number") return Number.isFinite(data) ? String(data) : ""
  if (typeof data === "boolean") return data ? "TRUE" : "FALSE"
  return ""
}

export function normalizeHeaderTitle(header: string, index: number): string {
  const trimmed = header.trim()
  return trimmed.length > 0 ? trimmed : `Column ${index + 1}`
}

export function columnIndexToA1(col: number) {
  let columnNumber = col + 1
  let columnName = ""
  while (columnNumber > 0) {
    const remainder = (columnNumber - 1) % 26
    columnName = String.fromCharCode(65 + remainder) + columnName
    columnNumber = Math.floor((columnNumber - 1) / 26)
  }
  return columnName
}

export function cellAddressToA1(col: number, row: number) {
  return `${columnIndexToA1(col)}${row + 1}`
}

export function cellMatchesQuery(displayValue: string, query: string) {
  return displayValue.toLowerCase().includes(query)
}

export function ensureCsvExtension(fileName: string) {
  const lowerFileName = fileName.toLowerCase()
  return lowerFileName.endsWith(".csv") || lowerFileName.endsWith(".tsv")
    ? fileName
    : `${fileName}.csv`
}

export function downloadTextFile(text: string, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.rel = "noopener"
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
}

export async function findCsvSearchResults(
  headers: string[],
  rows: string[][],
  rawQuery: string,
) {
  const query = rawQuery.trim().toLowerCase()
  if (!query) return [] as CsvSearchResult[]
  const results: CsvSearchResult[] = []
  const columnCount = Math.max(
    headers.length,
    rows.reduce((maxCount, row) => Math.max(maxCount, row.length), 0),
  )
  for (let batchStartRow = 0; batchStartRow < rows.length; batchStartRow += 500) {
    const batchEndRow = Math.min(batchStartRow + 500, rows.length)
    for (let row = batchStartRow; row < batchEndRow; row += 1) {
      const rowValues = rows[row] ?? []
      for (let col = 0; col < columnCount; col += 1) {
        const displayValue = rowValues[col] ?? ""
        if (!cellMatchesQuery(displayValue, query)) continue
        results.push({
          col,
          row,
          displayValue,
          columnTitle: headers[col] ?? `Column ${col + 1}`,
        })
      }
    }
    if (batchEndRow < rows.length) {
      await new Promise<void>((resolve) => {
        window.setTimeout(resolve, 0)
      })
    }
  }
  return results
}

export function parseDelimitedText(text: string): {
  headers: string[]
  rows: string[][]
  error: string | null
} {
  const results = Papa.parse<Record<string, unknown>>(text, {
    header: true,
    skipEmptyLines: "greedy",
  })
  const objectRows = Array.isArray(results.data)
    ? results.data.filter(
        (row): row is Record<string, unknown> =>
          !!row && typeof row === "object" && !Array.isArray(row),
      )
    : []
  const metaFields = Array.isArray(results.meta.fields)
    ? results.meta.fields.map((field) => String(field))
    : []
  const fieldKeys =
    metaFields.length > 0
      ? metaFields
      : Object.keys(objectRows[0] ?? {}).filter((key) => key !== "__parsed_extra")
  const extraColumnCount = objectRows.reduce((maxCount, row) => {
    const extras = row.__parsed_extra
    return Array.isArray(extras) ? Math.max(maxCount, extras.length) : maxCount
  }, 0)
  const headers = [
    ...fieldKeys.map((field, index) => normalizeHeaderTitle(field, index)),
    ...Array.from({ length: extraColumnCount }, (_, index) => `Extra ${index + 1}`),
  ]
  const rows = objectRows.map((row) => {
    const baseValues = fieldKeys.map((fieldKey) => toDisplayString(row[fieldKey]))
    const extras = Array.isArray(row.__parsed_extra)
      ? row.__parsed_extra.map((value) => toDisplayString(value))
      : []
    const paddedExtras =
      extras.length >= extraColumnCount
        ? extras.slice(0, extraColumnCount)
        : [...extras, ...Array.from({ length: extraColumnCount - extras.length }, () => "")]
    return [...baseValues, ...paddedExtras]
  })
  const firstError =
    Array.isArray(results.errors) && results.errors.length > 0 ? results.errors[0] : null
  return {
    headers,
    rows,
    error:
      rows.length === 0 && firstError
        ? String(firstError.message ?? "Could not parse CSV file.")
        : null,
  }
}
