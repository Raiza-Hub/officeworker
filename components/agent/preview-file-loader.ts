export async function loadPreviewText(
  url: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Could not load this file");
  return response.text();
}

export async function loadPreviewBuffer(
  url: string,
  signal?: AbortSignal,
): Promise<ArrayBuffer> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Could not load this file");
  return response.arrayBuffer();
}

export async function loadCsvPreview(
  url: string,
  signal?: AbortSignal,
): Promise<string> {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("Failed to download file for preview");
  const text = (await response.text()).replace(/^\uFEFF/, "");
  if (!text.trim()) throw new Error("This spreadsheet is empty");
  return text;
}
