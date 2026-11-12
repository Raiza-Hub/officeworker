"use client"

import type { DataEditorRef, GridSelection, Item } from "@glideapps/glide-data-grid"
import { CompactSelection, emptyGridSelection } from "@glideapps/glide-data-grid"
import { ArrowRight, ChevronLeft, Search } from "lucide-react"
import * as React from "react"

import { ToolbarTooltip } from "@/components/extend/toolbar-atoms"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CSV_SEARCH_DEBOUNCE_MS } from "./csv-constants"
import { cellAddressToA1, findCsvSearchResults, type CsvSearchResult } from "./csv-utils"

function createSingleCellSelection(cell: Item): GridSelection {
  const [col, row] = cell
  return {
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
    current: {
      cell,
      range: { x: col, y: row, width: 1, height: 1 },
      rangeStack: [],
    },
  }
}

export function CsvSearchPopover({
  headers,
  rows,
  gridRef,
  controlsDisabled,
  onGridSelectionChange,
}: {
  headers: string[]
  rows: string[][]
  gridRef: React.RefObject<DataEditorRef | null>
  controlsDisabled: boolean
  onGridSelectionChange: (selection: GridSelection) => void
}) {
  const [searchDraft, setSearchDraft] = React.useState("")
  const [searchQuery, setSearchQuery] = React.useState("")
  const [searchResults, setSearchResults] = React.useState<CsvSearchResult[]>([])
  const [activeResultIndex, setActiveResultIndex] = React.useState(0)
  const [isSearching, setIsSearching] = React.useState(false)
  const searchRequestIdRef = React.useRef(0)
  const appliedResultKeyRef = React.useRef("")
  const activeResult = searchResults[activeResultIndex] ?? null
  const activeResultKey = activeResult ? `${activeResult.row}:${activeResult.col}` : ""
  const hasActiveQuery = Boolean(searchQuery.trim())
  const resultLabel = isSearching
    ? "Searching"
    : !hasActiveQuery
      ? "No search"
      : searchResults.length
        ? `${activeResultIndex + 1} / ${searchResults.length}`
        : "No results"

  const runSearch = React.useCallback(
    (rawQuery: string) => {
      const nextQuery = rawQuery.trim()
      const requestId = searchRequestIdRef.current + 1
      searchRequestIdRef.current = requestId
      appliedResultKeyRef.current = ""
      setSearchQuery(nextQuery)
      setActiveResultIndex(0)
      if (!nextQuery) {
        setSearchResults([])
        setIsSearching(false)
        return
      }
      setIsSearching(true)
      void findCsvSearchResults(headers, rows, nextQuery)
        .then((nextResults) => {
          if (searchRequestIdRef.current !== requestId) return
          setSearchResults(nextResults)
        })
        .catch(() => {
          if (searchRequestIdRef.current !== requestId) return
          setSearchResults([])
        })
        .finally(() => {
          if (searchRequestIdRef.current !== requestId) return
          setIsSearching(false)
        })
    },
    [headers, rows],
  )

  React.useEffect(() => {
    if (!searchDraft.trim()) return
    const timeoutId = window.setTimeout(() => {
      runSearch(searchDraft)
    }, CSV_SEARCH_DEBOUNCE_MS)
    return () => window.clearTimeout(timeoutId)
  }, [runSearch, searchDraft])

  const handleSearchDraftChange = (nextDraft: string) => {
    searchRequestIdRef.current += 1
    setSearchDraft(nextDraft)
    if (!nextDraft.trim()) {
      runSearch("")
      return
    }
    setIsSearching(true)
  }

  const clearSearch = React.useCallback(() => {
    searchRequestIdRef.current += 1
    setSearchDraft("")
    setSearchQuery("")
    setSearchResults([])
    setActiveResultIndex(0)
    setIsSearching(false)
    appliedResultKeyRef.current = ""
    onGridSelectionChange(emptyGridSelection)
  }, [onGridSelectionChange])

  const goToRelativeResult = React.useCallback(
    (direction: 1 | -1) => {
      if (!searchResults.length) return
      setActiveResultIndex(
        (currentIndex) =>
          (currentIndex + direction + searchResults.length) % searchResults.length,
      )
    },
    [searchResults.length],
  )

  React.useEffect(() => {
    return () => {
      searchRequestIdRef.current += 1
    }
  }, [])

  React.useEffect(() => {
    if (!activeResult) return
    if (appliedResultKeyRef.current === activeResultKey) return
    appliedResultKeyRef.current = activeResultKey
    const cell: Item = [activeResult.col, activeResult.row]
    onGridSelectionChange(createSingleCellSelection(cell))
    const frame = window.requestAnimationFrame(() => {
      gridRef.current?.scrollTo(activeResult.col, activeResult.row, "both", 48, 48, {
        vAlign: "center",
        hAlign: "center",
      })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [activeResult, activeResultKey, gridRef, onGridSelectionChange])

  return (
    <Popover>
      <ToolbarTooltip label="Search CSV">
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Search CSV"
              disabled={controlsDisabled}
            >
              <Search className="size-4" />
            </Button>
          }
        ></PopoverTrigger>
      </ToolbarTooltip>
      <PopoverContent align="end" className="w-72">
        <div className="space-y-3">
          <Input
            placeholder="Search CSV"
            value={searchDraft}
            onChange={(event) => handleSearchDraftChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return
              event.preventDefault()
              if (event.shiftKey && searchResults.length) {
                goToRelativeResult(-1)
              } else if (searchResults.length) {
                goToRelativeResult(1)
              } else if (searchDraft.trim()) {
                runSearch(searchDraft)
              }
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 text-xs text-muted-foreground">
              <div className="truncate">
                {searchResults.length ? (
                  <>
                    <span className="text-primary">{activeResultIndex + 1}</span>
                    {` / ${searchResults.length}`}
                  </>
                ) : (
                  resultLabel
                )}
              </div>
              {activeResult ? (
                <div className="mt-0.5 truncate">
                  {activeResult.columnTitle}!{cellAddressToA1(activeResult.col, activeResult.row)}
                </div>
              ) : null}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Previous result"
                disabled={isSearching || searchResults.length === 0}
                onClick={() => goToRelativeResult(-1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label="Next result"
                disabled={isSearching || searchResults.length === 0}
                onClick={() => goToRelativeResult(1)}
              >
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
          <div className="flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={clearSearch}>
              Clear
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
