"use client";

import {
  PreviewContentBody,
  type PreviewContentProps,
} from "./preview-content-parts";
import { resolvePreviewContentState } from "./preview-content-utils";

export function PreviewContent(props: PreviewContentProps) {
  const state = resolvePreviewContentState(
    props.open,
    props.previewUrl,
    props.kind,
  );

  return (
    <main
      className="flex min-h-0 min-w-0 flex-1 items-stretch justify-center overflow-hidden bg-white p-2 print:overflow-visible print:p-0"
      onClick={(event) => event.stopPropagation()}
    >
      <PreviewContentBody {...props} state={state} />
    </main>
  );
}
