import {
  CompleteMultipartUploadCommand,
  HeadObjectCommand,
  ListPartsCommand,
} from "@aws-sdk/client-s3";
import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { z } from "zod";
import { createR2Client, getR2Config, requireOwnedStorageKey } from "../r2";

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

export async function POST(request: Request) {
  if (!(await isAuthenticatedNextjs())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = getR2Config();
  if (!config) {
    return Response.json({ error: "R2 is not configured" }, { status: 500 });
  }

  let parsed: z.infer<typeof schema>;
  try {
    parsed = schema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
    }
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { key, uploadId } = parsed;

  if (!(await requireOwnedStorageKey(key))) {
    return Response.json({ error: "Not authorized for this storage key" }, { status: 403 });
  }

  const s3 = createR2Client(config);
  const bucket = config.bucket;

  async function headSize(): Promise<number | null> {
    try {
      const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      return typeof head.ContentLength === "number" ? head.ContentLength : null;
    } catch {
      return null;
    }
  }

  try {
    const parts: { number: number; etag: string }[] = [];
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
        if (part.PartNumber != null && part.ETag) {
          parts.push({ number: part.PartNumber, etag: part.ETag });
        }
      }
      nextPartNumberMarker =
        page.IsTruncated && page.NextPartNumberMarker ? page.NextPartNumberMarker : undefined;
    } while (nextPartNumberMarker);

    parts.sort((a, b) => a.number - b.number);

    if (parts.length === 0) {
      return Response.json({ error: "No uploaded parts found" }, { status: 400 });
    }

    await s3.send(
      new CompleteMultipartUploadCommand({
        Bucket: config.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map((part) => ({ PartNumber: part.number, ETag: part.etag })),
        },
      }),
    );

    const size = await headSize();
    return Response.json({ ok: true, size });
  } catch (error) {
    if (isNoSuchUpload(error)) {
      const size = await headSize();
      if (size != null) {
        return Response.json({ ok: true, size });
      }
      return Response.json({ error: "Upload session not found" }, { status: 404 });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to complete multipart upload" },
      { status: 502 },
    );
  }
}
