import { ListPartsCommand, UploadPartCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { z } from "zod";
import { createR2Client, getR2Config, requireOwnedStorageKey } from "../r2";

const PART_URL_TTL_SECONDS = 86_400;

const schema = z.object({
  key: z.string().trim().startsWith("documents/").max(300).refine((k) => !k.includes("..")),
  uploadId: z.string().trim().min(1).max(512),
});

function isNoSuchUpload(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      (("name" in error && (error as { name?: string }).name === "NoSuchUpload") ||
        ("$metadata" in error &&
          (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404)),
  );
}

export async function GET(request: Request) {
  if (!(await isAuthenticatedNextjs())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = getR2Config();
  if (!config) {
    return Response.json({ error: "R2 is not configured" }, { status: 500 });
  }

  const url = new URL(request.url);
  const parsed = schema.safeParse({
    key: url.searchParams.get("key") ?? "",
    uploadId: url.searchParams.get("uploadId") ?? "",
  });
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  const { key, uploadId } = parsed.data;

  if (!(await requireOwnedStorageKey(key))) {
    return Response.json({ error: "Not authorized for this storage key" }, { status: 403 });
  }

  const s3 = createR2Client(config);

  try {
    const parts: { number: number; etag: string; size: number }[] = [];
    let nextPartNumberMarker: string | undefined;

    do {
      const page = await s3.send(
        new ListPartsCommand({
          Bucket: config.bucket,
          Key: key,
          UploadId: uploadId,
          PartNumberMarker: nextPartNumberMarker,
        }),
      );
      for (const part of page.Parts ?? []) {
        if (part.PartNumber != null && part.ETag && part.Size != null) {
          parts.push({ number: part.PartNumber, etag: part.ETag, size: part.Size });
        }
      }
      nextPartNumberMarker =
        page.IsTruncated && page.NextPartNumberMarker ? page.NextPartNumberMarker : undefined;
    } while (nextPartNumberMarker);

    const partUrls: Record<number, string> = {};
    const totalParam = url.searchParams.get("total");
    if (totalParam) {
      const total = Number.parseInt(totalParam, 10);
      if (Number.isFinite(total) && total > 0 && total <= 10_000) {
        await Promise.all(
          Array.from({ length: total }, async (_, i) => {
            const partNumber = i + 1;
            partUrls[partNumber] = await getSignedUrl(
              s3,
              new UploadPartCommand({
                Bucket: config.bucket,
                Key: key,
                UploadId: uploadId,
                PartNumber: partNumber,
              }),
              { expiresIn: PART_URL_TTL_SECONDS },
            );
          }),
        );
      }
    }

    return Response.json({ parts, partUrls });
  } catch (error) {
    if (isNoSuchUpload(error)) {
      return Response.json({ error: "Upload session not found" }, { status: 404 });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to list upload parts" },
      { status: 502 },
    );
  }
}
