"use client"

import { Download, Ellipsis, Upload } from "lucide-react"
import { InlineSpinner } from "@/components/extend/toolbar-atoms"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function CsvFileActionsMenu({
  downloadDisabled,
  isPending,
  onDownload,
  onUploadClick,
}: {
  downloadDisabled: boolean
  isPending: boolean
  onDownload: () => void
  onUploadClick: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Open CSV actions"
            disabled={isPending}
          >
            <Ellipsis className="size-4" />
          </Button>
        }
      ></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40">
        <DropdownMenuItem disabled={downloadDisabled} onClick={onDownload}>
          <Download className="size-4" />
          Download
        </DropdownMenuItem>
        <DropdownMenuItem disabled={isPending} onClick={onUploadClick}>
          {isPending ? <InlineSpinner className="size-4" /> : <Upload className="size-4" />}
          Upload
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
