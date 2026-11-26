import { useEffect, useState } from "react";

export type ObjectUrlState = {
  blob: Blob;
  url: string;
};

export function visibleObjectUrl(
  state: ObjectUrlState | null,
  blob: Blob | null,
) {
  return state?.blob === blob ? state.url : null;
}

export function useObjectUrl(blob: Blob | null) {
  const [state, setState] = useState<ObjectUrlState | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!blob) {
      queueMicrotask(() => {
        if (!cancelled) setState(null);
      });
      return () => {
        cancelled = true;
      };
    }

    const objectUrl = URL.createObjectURL(blob);
    queueMicrotask(() => {
      if (!cancelled) setState({ blob, url: objectUrl });
    });

    return () => {
      cancelled = true;
      URL.revokeObjectURL(objectUrl);
    };
  }, [blob]);

  return visibleObjectUrl(state, blob);
}
