import type { XlsxCellStyleContext } from "@extend-ai/react-xlsx";

export function getXlsxCellStyle({ resolvedStyle }: XlsxCellStyleContext) {
  const decoration = resolvedStyle.textDecoration;
  if (typeof decoration !== "string" || !decoration.includes("line-through")) {
    return undefined;
  }
  const remainingDecorations = decoration
    .split(/\s+/)
    .filter((value) => value !== "line-through");
  return {
    textDecoration: remainingDecorations.length
      ? remainingDecorations.join(" ")
      : "none",
  };
}
