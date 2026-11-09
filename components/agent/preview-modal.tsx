"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import {
  Download,
  FileText,
  Link2,
  LoaderCircle,
  Minus,
  Plus,
  Printer,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getPreviewUrl } from "@/components/agent/preview-url-cache";

const PdfPreview = dynamic(
  () =>
    import("@/components/agent/pdf-preview").then((module) => module.PdfPreview),
  {
    ssr: false,
    // React-PDF uses browser APIs and must be loaded on the client.
    loading: () => (
      <div className="flex h-full min-h-[300px] w-full items-center justify-center gap-2 text-[13px] text-[#85878e]">
        <LoaderCircle
          aria-hidden="true"
          className="size-4 animate-spin text-[#626bd9]"
        />
        <span>Loading preview…</span>
      </div>
    ),
  },
);

type PreviewModalProps = {
  storageKey: string | null;
  filename: string;
  mediaType?: string;
  onClose: () => void;
};

type PreviewKind =
  | "image"
  | "pdf"
  | "office"
  | "text"
  | "audio"
  | "video"
  | "unsupported";

function getPreviewKind(filename: string, mediaType = ""): PreviewKind {
  const extension = filename.split(".").pop()?.toLowerCase();
  if (
    mediaType.startsWith("image/") ||
    ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "tif", "tiff"].includes(extension ?? "")
  ) {
    return "image";
  }
  if (mediaType === "application/pdf" || extension === "pdf") return "pdf";
  if (
    ["doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp", "rtf"].includes(
      extension ?? "",
    )
  ) {
    return "office";
  }
  if (
    ["txt", "csv", "md", "json", "xml", "html", "htm", "log", "yaml", "yml"].includes(
      extension ?? "",
    ) ||
    mediaType.startsWith("text/")
  ) {
    return "text";
  }
  if (["mp4", "webm", "mov", "m4v", "ogv"].includes(extension ?? "")) {
    return "video";
  }
  if (["mp3", "wav", "m4a", "aac", "ogg", "flac"].includes(extension ?? "")) {
    return "audio";
  }
  return "unsupported";
}

export function PreviewModal({
  storageKey,
  filename,
  mediaType,
  onClose,
}: PreviewModalProps) {
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isContentLoading, setIsContentLoading] = useState(true);
  const [zoom, setZoom] = useState(100);
  const closeRef = useRef(onClose);
  const kind = getPreviewKind(filename, mediaType);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  const close = useCallback(() => closeRef.current(), []);

  useEffect(() => {
    if (!storageKey) return;
    let cancelled = false;

    void (async () => {
      try {
        const data = await getPreviewUrl(storageKey);
        if (!cancelled) {
          setFileUrl(data.url);
          setIsContentLoading(kind === "pdf" || kind === "image" || kind === "office");
        }
      } catch (error) {
        if (cancelled) return;
        setIsContentLoading(false);
        toast.error("Preview unavailable", {
          description:
            error instanceof Error ? error.message : "Could not load this file",
        });
        close();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [storageKey, close, kind]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [close]);

  const officeUrl =
    fileUrl && kind === "office"
      ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`
      : null;
  const previewUrl = officeUrl ?? fileUrl;
  const isDocumentLoading = !previewUrl || isContentLoading;

  async function handleDownload() {
    if (!storageKey) return;
    setIsDownloading(true);
    try {
      const response = await fetch("/api/files/preview-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: storageKey, download: true }),
      });
      const data = (await response.json()) as {
        url?: string;
        filename?: string;
        error?: string;
      };
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Could not download this file");
      }
      const anchor = document.createElement("a");
      anchor.href = data.url;
      anchor.download = data.filename ?? filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setIsDownloading(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Download failed");
      setIsDownloading(false);
    }
  }

  async function handleCopyLink() {
    if (!fileUrl) return;
    try {
      await navigator.clipboard.writeText(fileUrl);
      toast.success("Temporary file link copied", {
        description: "This private link expires in one hour.",
      });
    } catch {
      toast.error("Could not copy the file link");
    }
  }

  const iconButtonClass =
    "inline-flex size-9 items-center justify-center rounded-lg text-[#5f6368] transition-colors hover:bg-[#f1f3f4] hover:text-[#202124] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#626bd9]/50 disabled:cursor-not-allowed disabled:opacity-40";

  const markPreviewError = useCallback((error: Error) => {
    setIsContentLoading(false);
    setPreviewError(error.message || "Could not display this file");
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${filename} preview`}
      onClick={close}
      id="attachment-preview-root"
      className="fixed inset-0 z-50 flex flex-col bg-white text-[#202124]"
    >
      <header
        id="attachment-preview-toolbar"
        onClick={(event) => event.stopPropagation()}
        className="z-10 flex h-11 min-h-11 shrink-0 items-center justify-between gap-3 border-b border-[#eeeeef] bg-white px-3 sm:px-4 print:hidden"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {isDocumentLoading && (
              <LoaderCircle
                aria-hidden="true"
                className="size-3.5 shrink-0 animate-spin text-[#626bd9]"
              />
            )}
            <span className="truncate text-[13px] font-medium text-[#292a30]">
              {filename}
            </span>
          </div>

          {(kind === "pdf" || kind === "image") && (
            <div className="flex shrink-0 items-center gap-1 text-[#5f6368]">
              <button
                type="button"
                aria-label="Zoom out"
                title="Zoom out"
                className={iconButtonClass}
                disabled={zoom <= 50}
                onClick={() => setZoom((current) => Math.max(50, current - 10))}
              >
                <Minus aria-hidden="true" className="size-4" />
              </button>
              <span className="w-12 text-center text-[12px] tabular-nums text-[#5f6368]">
                {zoom}%
              </span>
              <button
                type="button"
                aria-label="Zoom in"
                title="Zoom in"
                className={iconButtonClass}
                disabled={zoom >= 200}
                onClick={() => setZoom((current) => Math.min(200, current + 10))}
              >
                <Plus aria-hidden="true" className="size-4" />
              </button>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="Download file"
            title="Download"
            disabled={!fileUrl || isDownloading}
            onClick={() => void handleDownload()}
            className={iconButtonClass}
          >
            {isDownloading ? (
              <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            ) : (
              <Download aria-hidden="true" className="size-4" />
            )}
          </button>
          <button
            type="button"
            aria-label="Copy file link"
            title="Copy link"
            disabled={!fileUrl}
            onClick={() => void handleCopyLink()}
            className={iconButtonClass}
          >
            <Link2 aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Print file"
            title="Print"
            disabled={!fileUrl}
            onClick={() => window.print()}
            className={iconButtonClass}
          >
            <Printer aria-hidden="true" className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Close preview"
            title="Close preview"
            onClick={close}
            className={iconButtonClass}
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
      </header>

      <main
        className="flex min-h-0 flex-1 items-start justify-center overflow-auto bg-white p-2 print:overflow-visible print:p-0"
        onClick={(event) => event.stopPropagation()}
      >
        {!previewError && !previewUrl ? (
          <div className="flex h-full min-h-[300px] w-full items-center justify-center gap-2 text-[13px] text-[#85878e]">
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin text-[#626bd9]"
            />
            <span>Loading preview…</span>
          </div>
        ) : !previewError && (kind === "pdf" ? (
          <PdfPreview
            src={previewUrl ?? undefined}
            zoom={zoom}
            onError={markPreviewError}
            onLoaded={() => setIsContentLoading(false)}
          />
        ) : kind === "image" ? (
          <div
            className="relative min-h-full min-w-full shrink-0"
            aria-label={`${filename} image preview`}
            style={{ width: `${zoom}%`, height: `${zoom}%` }}
          >
            {isContentLoading && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-white text-[13px] text-[#85878e]">
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin text-[#626bd9]"
                />
                <span>Loading preview…</span>
              </div>
            )}
            <Image
              src={previewUrl!}
              alt={filename}
              fill
              unoptimized
              onLoad={() => setIsContentLoading(false)}
              onError={() => {
                setIsContentLoading(false);
                markPreviewError(new Error("Could not display this image"));
              }}
              className="object-contain"
            />
          </div>
        ) : kind === "video" ? (
          <video
            src={previewUrl!}
            controls
            className="max-h-full max-w-full"
            aria-label={`${filename} video preview`}
            onError={() => markPreviewError(new Error("Could not play this video"))}
          />
        ) : kind === "audio" ? (
          <audio
            src={previewUrl!}
            controls
            className="w-full max-w-xl"
            aria-label={`${filename} audio preview`}
            onError={() => markPreviewError(new Error("Could not play this audio"))}
          />
        ) : kind === "office" ? (
          <div className="relative h-full w-full">
            {isContentLoading && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 bg-white text-[13px] text-[#85878e]">
                <LoaderCircle
                  aria-hidden="true"
                  className="size-4 animate-spin text-[#626bd9]"
                />
                <span>Loading preview…</span>
              </div>
            )}
            <iframe
              key={`${kind}-${previewUrl}`}
              src={previewUrl!}
              title={`${filename} preview`}
              onLoad={() => setIsContentLoading(false)}
              className="h-full w-full border-0 bg-white"
            />
          </div>
        ) : kind === "unsupported" ? (
          <div className="flex max-w-sm flex-col items-center gap-3 p-8 text-center">
            <FileText aria-hidden="true" className="size-8 text-[#70757a]" />
            <p className="m-0 text-[13px] text-[#5f6368]">
              This file format can’t be displayed in the browser. Download it to
              view the contents.
            </p>
          </div>
        ) : (
          <iframe
            key={`${kind}-${previewUrl}`}
            src={previewUrl!}
            title={`${filename} preview`}
            className="h-full w-full border-0 bg-white"
          />
        ))}
        {previewError && (
          <div className="absolute inset-x-0 bottom-0 top-11 z-[1] flex flex-col items-center justify-center gap-3 bg-white p-6 text-center">
            <FileText aria-hidden="true" className="size-8 text-[#70757a]" />
            <p className="m-0 max-w-sm text-[13px] text-[#5f6368]">{previewError}</p>
            <button
              type="button"
              onClick={() => void handleDownload()}
              className="rounded-md bg-[#626bd9] px-3 py-2 text-sm text-white hover:bg-[#555fc9]"
            >
              Download file
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
