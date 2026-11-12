"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import {
  DocxEditor,
  useDocxSource,
  useFonts,
  useZoom,
  type Editor,
} from "@docx-editor.dev/react";
import { packagedFonts } from "@docx-editor.dev/fonts";
import "@docx-editor.dev/core/styles/editor.css";
import { PreviewLoading } from "@/components/extend/preview-loading";

export type DocxViewerZoomApi = {
  zoom: number;
  isFit: boolean;
  canZoomIn: boolean;
  canZoomOut: boolean;
  zoomIn: () => void;
  zoomOut: () => void;
  auto: () => void;
  setZoom: (zoom: number) => void;
};

function ZoomBridge({
  onZoomApi,
}: {
  onZoomApi: (api: DocxViewerZoomApi | null) => void;
}) {
  const { zoom, isFit, canZoomIn, canZoomOut, zoomIn, zoomOut, auto, setZoom } =
    useZoom();
  useEffect(() => {
    onZoomApi({
      zoom,
      isFit,
      canZoomIn,
      canZoomOut,
      zoomIn,
      zoomOut,
      auto,
      setZoom,
    });
    return () => onZoomApi(null);
  }, [zoom, isFit, canZoomIn, canZoomOut, zoomIn, zoomOut, auto, setZoom, onZoomApi]);
  return null;
}

export function DocxPreview({
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
  onZoomApi?: (api: DocxViewerZoomApi | null) => void;
  onEditorReady?: (editor: Editor | null) => void;
}) {
  const fontResolver = useFonts(packagedFonts());
  const { document, fonts, error } = useDocxSource(src, { fonts: fontResolver });
  const editorRef = useRef<Editor | null>(null);
  const callOnError = useEffectEvent((error: Error) => onError?.(error));
  const callOnEditorReady = useEffectEvent((editor: Editor | null) =>
    onEditorReady?.(editor),
  );

  useEffect(() => {
    if (error) {
      callOnError(error);
    }
  }, [error]);

  useEffect(() => {
    return () => callOnEditorReady(null);
  }, []);

  if (!document) {
    return <PreviewLoading className="h-full w-full" />;
  }

  return (
    <div className="docx-editor flex h-full min-h-0 w-full flex-col">
      <DocxEditor.Root
        document={document}
        fonts={fonts}
        mode={editable ? "edit" : "view"}
        zoomMode="auto"
        onReady={(editor) => {
          editorRef.current = editor;
          onEditorReady?.(editor);
          onLoaded?.();
        }}
      >
        {editable ? <DocxEditor.Toolbar /> : null}
        {onZoomApi ? <ZoomBridge onZoomApi={onZoomApi} /> : null}
        <DocxEditor.Viewport style={{ flex: 1, minHeight: 0 }}>
          <DocxEditor.Content />
          <DocxEditor.HyperLink />
          <DocxEditor.ContentControl />
          <DocxEditor.Equation />
          <DocxEditor.ContextMenu />
        </DocxEditor.Viewport>
      </DocxEditor.Root>
    </div>
  );
}
