export const CSV_ZOOM_OPTIONS = [0.75, 1, 1.25, 1.5, 2] as const
export const CSV_SEARCH_BATCH_ROW_COUNT = 500
export const CSV_SEARCH_DEBOUNCE_MS = 300

export type CsvViewerSaveApi = {
  getText: () => string
}
