import { CSV_ZOOM_OPTIONS } from "@/components/extend/csv-viewer/csv-constants";

export function stepCsvZoom(
  csvZoom: number,
  direction: 1 | -1,
  onChange: (zoom: number) => void,
) {
  const index = CSV_ZOOM_OPTIONS.indexOf(
    csvZoom as (typeof CSV_ZOOM_OPTIONS)[number],
  );
  const nextIndex = Math.min(
    CSV_ZOOM_OPTIONS.length - 1,
    Math.max(0, index + direction),
  );
  onChange(CSV_ZOOM_OPTIONS[nextIndex]);
}

export function stepImageZoom(
  imageZoom: number,
  direction: 1 | -1,
  onChange: (zoom: number) => void,
) {
  onChange(
    Math.min(4, Math.max(0.25, Number((imageZoom + 0.25 * direction).toFixed(2)))),
  );
}
