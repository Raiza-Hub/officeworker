"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import {
  hasRevealedPreviewImageUrl,
  markRevealedPreviewImageUrl,
  releaseRevealedPreviewImageUrl,
} from "@/lib/file-thumbnail-store"
import { getThumbnailDisplayState } from "@/lib/file-thumbnail-utils"
import { FileThumbnailLoadingOverlay } from "./file-thumbnail-loading-overlay"

export type ThumbnailFile = {
  name: string
  type: string
}
export type FileThumbnailProps = {
  file: ThumbnailFile | File
  className?: string
  previewAspectRatio?: number
  previewClassName?: string
  previewContent?: React.ReactNode
  previewImageUrl?: string | null
  isLoading?: boolean
  hasError?: boolean
}
export function FileThumbnail({
  className,
  previewAspectRatio,
  previewClassName,
  previewContent,
  previewImageUrl,
  isLoading = false,
  hasError = false,
}: FileThumbnailProps) {
  const imageRef = React.useRef<HTMLImageElement | null>(null)
  const revealFrameRef = React.useRef<number | null>(null)
  const [loadedPreviewImageUrl, setLoadedPreviewImageUrl] = React.useState<
    string | null
  >(() =>
    previewImageUrl && hasRevealedPreviewImageUrl(previewImageUrl)
      ? previewImageUrl
      : null
  )
  const [failedPreviewImageUrl, setFailedPreviewImageUrl] = React.useState<
    string | null
  >(null)
  const { showLoading, showFallback } = getThumbnailDisplayState({
    isLoading,
    hasError,
    previewImageUrl,
    previewContent,
    loadedPreviewImageUrl,
    failedPreviewImageUrl,
  })
  const cancelImageReveal = React.useCallback(() => {
    if (revealFrameRef.current === null) return
    window.cancelAnimationFrame(revealFrameRef.current)
    revealFrameRef.current = null
  }, [])
  const markImageLoaded = React.useCallback(
    (image: HTMLImageElement, imageUrl: string | null | undefined) => {
      if (!imageUrl) return
      const didLoad = image.naturalWidth > 0 && image.naturalHeight > 0
      setFailedPreviewImageUrl(didLoad ? null : imageUrl)
      if (didLoad) {
        markRevealedPreviewImageUrl(imageUrl)
        cancelImageReveal()
        revealFrameRef.current = window.requestAnimationFrame(() => {
          revealFrameRef.current = window.requestAnimationFrame(() => {
            setLoadedPreviewImageUrl(imageUrl)
            revealFrameRef.current = null
          })
        })
      }
    },
    [cancelImageReveal]
  )
  React.useEffect(() => {
    cancelImageReveal()
  }, [cancelImageReveal, previewImageUrl])
  React.useEffect(() => cancelImageReveal, [cancelImageReveal])
  React.useEffect(() => {
    const image = imageRef.current
    if (!image || !previewImageUrl) return
    if (image.complete) {
      markImageLoaded(image, previewImageUrl)
    }
  }, [markImageLoaded, previewImageUrl])
  return (
    <div
      className={cn(
        "group overflow-hidden rounded-lg border bg-background text-foreground",
        className
      )}
    >
      <div
        className={cn(
          "relative aspect-square overflow-hidden bg-muted [contain:layout_paint]",
          previewClassName
        )}
        style={
          previewAspectRatio
            ? { aspectRatio: String(previewAspectRatio) }
            : undefined
        }
      >
        {previewImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- Preview URLs can be transient object or presigned URLs outside Next image optimization.
          <img
            ref={imageRef}
            src={previewImageUrl}
            alt=""
            draggable={false}
            loading="lazy"
            decoding="async"
            className={cn(
              "absolute inset-0 block size-full object-cover transition-[opacity,filter] duration-160 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
              showLoading ? "opacity-0 blur-sm" : "blur-0 opacity-100"
            )}
            onLoad={(event) => {
              markImageLoaded(event.currentTarget, previewImageUrl)
            }}
            onError={() => {
              if (previewImageUrl) {
                releaseRevealedPreviewImageUrl(previewImageUrl)
                cancelImageReveal()
                setFailedPreviewImageUrl(previewImageUrl)
                setLoadedPreviewImageUrl((currentUrl) =>
                  currentUrl === previewImageUrl ? null : currentUrl
                )
              }
            }}
          />
        ) : null}
        {previewContent ? (
          <div
            className={cn(
              "absolute inset-0 size-full transition-[opacity,filter] duration-160 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
              showLoading ? "opacity-0 blur-sm" : "blur-0 opacity-100"
            )}
          >
            {previewContent}
          </div>
        ) : null}
        {showLoading ? <FileThumbnailLoadingOverlay /> : null}
        {showFallback ? (
          <div className="absolute inset-0 bg-muted" aria-hidden="true" />
        ) : null}
      </div>
    </div>
  )
}
