"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import {
  PptxEditor,
  useFonts,
  usePptxSource,
  useZoom,
  type PptxEditorInstance,
} from "@pptx-editor.dev/react";
import { packagedFonts } from "@docx-editor.dev/fonts";
import "@pptx-editor.dev/core/styles/editor.css";
import { PreviewLoading } from "@/components/extend/preview-loading";

export type PptxViewerZoomApi = {
  zoom: number;
  isFit: boolean;
  canZoomIn: boolean;
  canZoomOut: boolean;
  zoomIn: () => void;
  zoomOut: () => void;
  fit: () => void;
  setZoom: (zoom: number) => void;
};

function ZoomBridge({
  onZoomApi,
}: {
  onZoomApi: (api: PptxViewerZoomApi | null) => void;
}) {
  const { zoom, isFit, canZoomIn, canZoomOut, zoomIn, zoomOut, fit, setZoom } =
    useZoom();
  useEffect(() => {
    onZoomApi({
      zoom,
      isFit,
      canZoomIn,
      canZoomOut,
      zoomIn,
      zoomOut,
      fit,
      setZoom,
    });
    return () => onZoomApi(null);
  }, [zoom, isFit, canZoomIn, canZoomOut, zoomIn, zoomOut, fit, setZoom, onZoomApi]);
  return null;
}

export function PptxPreview({
  src,
  editable = false,
  onLoaded,
  onError,
  onZoomApi,
  onEditorReady,
}: {
  src: string;
  editable?: boolean;
  onLoaded?: () => void;
  onError?: (error: Error) => void;
  onZoomApi?: (api: PptxViewerZoomApi | null) => void;
  onEditorReady?: (editor: PptxEditorInstance | null) => void;
}) {
  const fontResolver = useFonts(packagedFonts());
  const { document, fonts, error, isLoading } = usePptxSource(src, {
    fonts: fontResolver,
  });
  const editorRef = useRef<PptxEditorInstance | null>(null);
  const callOnError = useEffectEvent((error: Error) => onError?.(error));
  const callOnLoaded = useEffectEvent(() => onLoaded?.());
  const callOnEditorReady = useEffectEvent((editor: PptxEditorInstance | null) =>
    onEditorReady?.(editor),
  );

  useEffect(() => {
    if (error) {
      callOnError(error);
    }
  }, [error]);

  useEffect(() => {
    if (!isLoading && document) {
      callOnLoaded();
    }
  }, [isLoading, document]);

  useEffect(() => {
    return () => callOnEditorReady(null);
  }, []);

  if (isLoading || !document) {
    return <PreviewLoading className="h-full w-full" />;
  }

  return (
    <div className="h-full min-h-0 w-full">
      <PptxEditor
        className="pptx-preview-shell h-full min-h-0"
        document={document}
        fonts={fonts}
        mode={editable ? "edit" : "view"}
        toolbar={editable}
        slideRail
        notesPane={false}
        onReady={(editor) => {
          editorRef.current = editor;
          onEditorReady?.(editor);
        }}
      >
        {onZoomApi ? <ZoomBridge onZoomApi={onZoomApi} /> : null}
      </PptxEditor>
    </div>
  );
}
