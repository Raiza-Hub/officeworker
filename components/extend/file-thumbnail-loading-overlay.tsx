"use client"

export function FileThumbnailLoadingOverlay() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 z-10 overflow-hidden bg-background"
    >
      <div className="absolute inset-0 animate-pulse bg-muted motion-reduce:animate-none" />
    </div>
  )
}
