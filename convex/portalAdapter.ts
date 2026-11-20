const TEACHER_PORTAL_ADAPTER_ID = "teacher_portal" as const;

export type ResolvedPortal = {
  adapterId: typeof TEACHER_PORTAL_ADAPTER_ID;
  portalUrl: string;
};

function normalizePortalUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Enter a valid portal URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Enter a valid portal URL");
  }
  const path = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/, "");
  return `${url.origin}${path}${url.search}${url.hash}`;
}

export function resolvePortalAdapter(portalUrl: string): ResolvedPortal {
  const normalizedUrl = normalizePortalUrl(portalUrl);
  return { adapterId: TEACHER_PORTAL_ADAPTER_ID, portalUrl: normalizedUrl };
}
