"use client"

import type * as GlideDataGrid from "@glideapps/glide-data-grid"
import type {
  DataEditorRef,
  EditableGridCell,
  EditListItem,
  GridCell,
  GridCellKind,
  GridColumn,
  GridSelection,
  Item,
  Theme,
} from "@glideapps/glide-data-grid"
import { emptyGridSelection } from "@glideapps/glide-data-grid"
import "@glideapps/glide-data-grid/dist/index.css"
import { CircleMinus, CirclePlusIcon, Upload } from "lucide-react"
import Papa from "papaparse"
import * as React from "react"

import { PreviewLoading } from "@/components/extend/preview-loading"
import { InlineSpinner, ToolbarTooltip } from "@/components/extend/toolbar-atoms"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

import { CSV_ZOOM_OPTIONS, type CsvViewerSaveApi } from "./csv-constants"
import { CsvFileActionsMenu } from "./csv-file-actions"
import { CsvSearchPopover } from "./csv-search-popover"
import { downloadTextFile, editedCellToText, ensureCsvExtension, parseDelimitedText } from "./csv-utils"
import { useIsDarkTheme } from "./use-dark-theme"

export type { CsvViewerSaveApi }

type GlideDataGridModule = typeof GlideDataGrid

type CsvViewerProps = {
  className?: string
  data?: string
  editable?: boolean
  search?: boolean
  showToolbar?: boolean
  zoom?: number
  onZoomChange?: (zoom: number) => void
  onSaveApi?: (api: CsvViewerSaveApi | null) => void
}

export function CsvViewer({
  className,
  data,
  editable = false,
  search = false,
  showToolbar = true,
  zoom: controlledZoom,
  onZoomChange,
  onSaveApi,
}: CsvViewerProps) {
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const gridRef = React.useRef<DataEditorRef | null>(null)
  const isDark = useIsDarkTheme()
  const [glide, setGlide] = React.useState<GlideDataGridModule | null>(null)
  const [uncontrolledZoom, setUncontrolledZoom] =
    React.useState<(typeof CSV_ZOOM_OPTIONS)[number]>(1)
  const zoom = (controlledZoom as (typeof CSV_ZOOM_OPTIONS)[number] | undefined) ?? uncontrolledZoom
  const setZoomValue = React.useCallback(
    (next: (typeof CSV_ZOOM_OPTIONS)[number]) => {
      if (controlledZoom === undefined) setUncontrolledZoom(next)
      onZoomChange?.(next)
    },
    [controlledZoom, onZoomChange],
  )
  const [gridSelection, setGridSelection] =
    React.useState<GridSelection>(emptyGridSelection)
  const [parsed, setParsed] = React.useState(() =>
    data ? parseDelimitedText(data) : { headers: [], rows: [], error: null },
  )
  const [uploadedFileName, setUploadedFileName] = React.useState<string | null>(null)
  const [isPending, setIsPending] = React.useState(false)
  const [dataRevision, setDataRevision] = React.useState(0)
  const dataIdentity = React.useMemo(
    () =>
      `${dataRevision}:${parsed.headers.join("\u0001")}:${parsed.rows.length}:${parsed.error ?? ""}`,
    [dataRevision, parsed.error, parsed.headers, parsed.rows.length],
  )
  const handleGridSelectionChange = React.useCallback((selection: GridSelection) => {
    setGridSelection(selection)
  }, [])
  const [previousData, setPreviousData] = React.useState(data)
  if (!Object.is(previousData, data)) {
    setPreviousData(data)
    if (data) {
      setParsed(parseDelimitedText(data))
      setUploadedFileName(null)
      setDataRevision((revision) => revision + 1)
    }
  }
  const [selectionSource, setSelectionSource] = React.useState({ dataRevision, search })
  if (selectionSource.dataRevision !== dataRevision || selectionSource.search !== search) {
    setSelectionSource({ dataRevision, search })
    if (selectionSource.dataRevision !== dataRevision || !search) {
      setGridSelection(emptyGridSelection)
    }
  }

  React.useEffect(() => {
    let mounted = true
    void import("@glideapps/glide-data-grid")
      .then((module) => {
        if (mounted) setGlide(module)
      })
      .catch(() => {
        // Grid stays unavailable; the parsed table fallback still renders.
      })
    return () => {
      mounted = false
    }
  }, [])

  const columnCount = Math.max(1, parsed.headers.length)
  const scale = React.useCallback((value: number) => Math.round(value * zoom), [zoom])
  const searchDisabled = Boolean(parsed.error) || parsed.rows.length === 0 || isPending

  const theme = React.useMemo<Partial<Theme>>(
    () => ({
      accentColor: isDark ? "#60a5fa" : "#2563eb",
      accentLight: isDark ? "#1d4ed826" : "#dbeafe",
      accentFg: "#ffffff",
      textDark: isDark ? "#e5e5e5" : "#171717",
      textMedium: isDark ? "#a3a3a3" : "#525252",
      textLight: isDark ? "#737373" : "#a3a3a3",
      textBubble: isDark ? "#f5f5f5" : "#171717",
      textHeader: isDark ? "#f5f5f5" : "#171717",
      textGroupHeader: isDark ? "#a3a3a3" : "#525252",
      bgCell: isDark ? "#0a0a0a" : "#ffffff",
      bgCellMedium: isDark ? "#171717" : "#fafafa",
      bgHeader: isDark ? "#171717" : "#fafafa",
      bgHeaderHasFocus: isDark ? "#262626" : "#f5f5f5",
      bgHeaderHovered: isDark ? "#262626" : "#f5f5f5",
      borderColor: isDark ? "#262626" : "#e5e5e5",
      horizontalBorderColor: isDark ? "#262626" : "#e5e5e5",
      cellHorizontalPadding: scale(8),
      cellVerticalPadding: Math.max(2, scale(3)),
      headerIconSize: scale(18),
      baseFontStyle: `${scale(13)}px`,
      headerFontStyle: `600 ${scale(13)}px`,
      markerFontStyle: `${scale(11)}px`,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      editorFontSize: `${scale(13)}px`,
    }),
    [isDark, scale],
  )

  const columns = React.useMemo<GridColumn[]>(
    () =>
      Array.from({ length: columnCount }, (_, index) => ({
        id: `column-${index}`,
        title: parsed.headers[index] ?? `Column ${index + 1}`,
        width: scale(index === 0 ? 180 : 160),
      })),
    [columnCount, parsed.headers, scale],
  )

  const getCellContent = React.useCallback(
    ([col, row]: Item): GridCell => {
      const value = parsed.rows[row]?.[col] ?? ""
      const textKind = glide?.GridCellKind.Text as GridCellKind.Text
      return {
        kind: textKind,
        data: value,
        displayData: value,
        allowOverlay: true,
        readonly: !editable,
      }
    },
    [editable, glide, parsed.rows],
  )

  const applyCellEdits = React.useCallback((newValues: readonly EditListItem[]) => {
    if (newValues.length === 0) return
    setParsed((current) => {
      const editedRowIndexes = new Set<number>()
      for (const { location } of newValues) {
        const rowIndex = location[1]
        if (rowIndex >= 0 && rowIndex < current.rows.length) editedRowIndexes.add(rowIndex)
      }
      if (editedRowIndexes.size === 0) return current
      const rows = current.rows.slice()
      for (const rowIndex of editedRowIndexes) rows[rowIndex] = rows[rowIndex].slice()
      for (const { location, value } of newValues) {
        const [col, row] = location
        if (col < 0 || row < 0 || row >= rows.length) continue
        const targetRow = rows[row]
        while (targetRow.length <= col) targetRow.push("")
        targetRow[col] = editedCellToText(value)
      }
      return { ...current, rows }
    })
  }, [])

  const handleCellEdited = React.useCallback(
    (cell: Item, newValue: EditableGridCell) => {
      applyCellEdits([{ location: cell, value: newValue }])
    },
    [applyCellEdits],
  )

  const handleCellsEdited = React.useCallback(
    (newValues: readonly EditListItem[]) => {
      applyCellEdits(newValues)
      return true
    },
    [applyCellEdits],
  )

  const parsedRef = React.useRef(parsed)
  React.useEffect(() => {
    parsedRef.current = parsed
  }, [parsed])

  const saveApi = React.useMemo<CsvViewerSaveApi>(
    () => ({
      getText: () =>
        Papa.unparse({ fields: parsedRef.current.headers, data: parsedRef.current.rows }),
    }),
    [],
  )

  React.useEffect(() => {
    onSaveApi?.(saveApi)
    return () => onSaveApi?.(null)
  }, [onSaveApi, saveApi])

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setIsPending(true)
    try {
      const text = await file.text()
      setParsed(parseDelimitedText(text))
      setUploadedFileName(file.name)
      setDataRevision((revision) => revision + 1)
    } catch (error) {
      setParsed({
        headers: [],
        rows: [],
        error: error instanceof Error ? error.message : "Could not read CSV file.",
      })
      setDataRevision((revision) => revision + 1)
    } finally {
      event.target.value = ""
      setIsPending(false)
    }
  }

  function stepZoom(direction: -1 | 1) {
    const index = CSV_ZOOM_OPTIONS.indexOf(zoom)
    const nextIndex = Math.min(CSV_ZOOM_OPTIONS.length - 1, Math.max(0, index + direction))
    setZoomValue(CSV_ZOOM_OPTIONS[nextIndex])
  }

  function handleDownload() {
    const text = Papa.unparse({ fields: parsed.headers, data: parsed.rows })
    downloadTextFile(
      text,
      ensureCsvExtension(uploadedFileName ?? "data.csv"),
      "text/csv;charset=utf-8",
    )
  }

  return (
    <div className={cn("flex h-[560px] w-full flex-col overflow-hidden bg-background", className)}>
      {showToolbar ? (
        <div className="flex min-h-12 flex-wrap items-center justify-end gap-2 border-b bg-background px-3 py-2">
          <TooltipProvider>
            <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-1">
              <div className="flex flex-none items-center gap-1">
                <ToolbarTooltip label="Zoom out">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Zoom out"
                    disabled={zoom <= CSV_ZOOM_OPTIONS[0]}
                    onClick={() => stepZoom(-1)}
                  >
                    <CircleMinus className="size-4" />
                  </Button>
                </ToolbarTooltip>
                <Select
                  value={zoom.toString()}
                  onValueChange={(value) =>
                    setZoomValue(Number(value) as (typeof CSV_ZOOM_OPTIONS)[number])
                  }
                  modal={false}
                >
                  <SelectTrigger size="sm" className="w-[84px] min-w-[84px]" aria-label="Zoom level">
                    <SelectValue>{Math.round(zoom * 100)}%</SelectValue>
                  </SelectTrigger>
                  <SelectContent align="end" alignItemWithTrigger={false}>
                    {CSV_ZOOM_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option.toString()}>
                        {Math.round(option * 100)}%
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ToolbarTooltip label="Zoom in">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Zoom in"
                    disabled={zoom >= CSV_ZOOM_OPTIONS[CSV_ZOOM_OPTIONS.length - 1]}
                    onClick={() => stepZoom(1)}
                  >
                    <CirclePlusIcon className="size-4" />
                  </Button>
                </ToolbarTooltip>
              </div>
              {search ? (
                <>
                  <Separator orientation="vertical" className="mx-1 h-4 self-center" />
                  <CsvSearchPopover
                    headers={parsed.headers}
                    rows={parsed.rows}
                    gridRef={gridRef}
                    key={dataIdentity}
                    controlsDisabled={searchDisabled}
                    onGridSelectionChange={handleGridSelectionChange}
                  />
                </>
              ) : null}
              <Separator orientation="vertical" className="mx-1 h-4 self-center" />
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.tsv,text/csv,text/tab-separated-values"
                className="hidden"
                onChange={handleUpload}
              />
              <CsvFileActionsMenu
                downloadDisabled={
                  Boolean(parsed.error) ||
                  isPending ||
                  (parsed.headers.length === 0 && parsed.rows.length === 0)
                }
                isPending={isPending}
                onDownload={handleDownload}
                onUploadClick={() => inputRef.current?.click()}
              />
            </div>
          </TooltipProvider>
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        {parsed.error ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-destructive">
            {parsed.error}
          </div>
        ) : parsed.rows.length === 0 ? (
          <div className="grid h-full place-items-center bg-background p-4">
            <div className="max-w-md rounded-lg border bg-background p-4 text-center text-sm shadow-xs">
              <p className="font-medium">Upload a CSV to preview</p>
              <p className="mt-1 text-muted-foreground">
                Pass delimited text with the <code>data</code> prop or upload a CSV file.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-4 relative"
                disabled={isPending}
                aria-busy={isPending || undefined}
                onClick={() => inputRef.current?.click()}
              >
                <span className={cn("contents", isPending && "invisible")}>
                  <Upload className="size-4" />
                  Upload CSV
                </span>
                {isPending ? <InlineSpinner className="pointer-events-none absolute" /> : null}
              </Button>
            </div>
          </div>
        ) : !glide ? (
          <PreviewLoading className="bg-background" />
        ) : (
          <glide.DataEditor
            ref={search ? gridRef : undefined}
            key={zoom}
            columns={columns}
            rows={parsed.rows.length}
            getCellContent={getCellContent}
            onCellEdited={editable ? handleCellEdited : undefined}
            onCellsEdited={editable ? handleCellsEdited : undefined}
            onPaste={editable ? true : undefined}
            rowMarkers="number"
            rowSelectionMode="multi"
            gridSelection={search ? gridSelection : undefined}
            onGridSelectionChange={search ? handleGridSelectionChange : undefined}
            scrollToActiveCell={search}
            keybindings={{ search: true }}
            smoothScrollX
            smoothScrollY
            getCellsForSelection
            width="100%"
            height="100%"
            theme={theme}
            rowHeight={scale(34)}
            headerHeight={scale(36)}
          />
        )}
      </div>
    </div>
  )
}
