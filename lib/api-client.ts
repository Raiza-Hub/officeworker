export async function readResponseError(
  response: Response,
  fallback: string,
): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    if (typeof data.error === "string" && data.error.length > 0) {
      return data.error;
    }
  } catch {
    return fallback;
  }
  return fallback;
}
