import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { z } from "zod";
import { getRedis } from "@/lib/redis";
import { createR2Client, getR2Config } from "../../documents/r2";

const PREVIEW_TTL_SECONDS = 3600;
const CACHE_TTL_SECONDS = PREVIEW_TTL_SECONDS - 300;
const CACHE_SAFETY_MARGIN_MS = 60_000;

type CachedPreviewUrl = { url: string; filename: string; expiresAt: number };

function cacheKey(storageKey: string, download: boolean) {
  return `preview:${download ? "dl" : "view"}:${storageKey}`;
}

function cacheHeaders(hit: boolean) {
  return { "X-Cache": hit ? "HIT" : "MISS" };
}

// Keys the app is allowed to sign: chat attachments (documents/) and
// submission artifacts (submissions/{id}/...). Ownership hardening lands in
// Phase 6 (Convex-side ownership check).
const keySchema = z
  .string()
  .trim()
  .max(300)
  .refine((key) => !key.includes(".."), "Invalid storage key")
  .refine(
    (key) => key.startsWith("documents/") || key.startsWith("submissions/"),
    "Key outside allowed prefixes",
  );

export async function POST(request: Request) {
  if (!(await isAuthenticatedNextjs())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let key: string;
  let download = false;
  try {
    const body = (await request.json()) as { key?: string; download?: boolean };
    const parsed = keySchema.parse(body.key);
    key = parsed;
    download = body.download === true;
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message ?? "Invalid key"
        : "Invalid JSON body";
    return Response.json({ error: message }, { status: 400 });
  }

  const config = getR2Config();
  if (!config) {
    return Response.json(
      { error: "R2 is not configured" },
      { status: 500 },
    );
  }

  const redis = getRedis();
  const redisKey = cacheKey(key, download);

  if (redis) {
    try {
      const cached = await redis.get<CachedPreviewUrl>(redisKey);
      if (cached?.url && cached.expiresAt > Date.now() + CACHE_SAFETY_MARGIN_MS) {
        return Response.json(cached, { headers: cacheHeaders(true) });
      }
    } catch (error) {
      console.warn("Preview URL cache read failed", error);
    }
  }

  const filename = key.split("/").pop() ?? "file";

  try {
    const url = await getSignedUrl(
      createR2Client(config),
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ...(download
          ? {
              ResponseContentDisposition: `attachment; filename="${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
            }
          : {}),
      }),
      { expiresIn: PREVIEW_TTL_SECONDS },
    );
    const payload: CachedPreviewUrl = {
      url,
      filename,
      expiresAt: Date.now() + PREVIEW_TTL_SECONDS * 1000,
    };

    if (redis) {
      try {
        await redis.set(redisKey, payload, { ex: CACHE_TTL_SECONDS });
      } catch (error) {
        console.warn("Preview URL cache write failed", error);
      }
    }

    return Response.json(payload, { headers: cacheHeaders(false) });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to sign URL" },
      { status: 502 },
    );
  }
}
