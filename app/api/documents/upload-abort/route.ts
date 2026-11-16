import { AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
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

  if (!(await requireOwnedStorageKey(parsed.key))) {
    return Response.json({ error: "Not authorized for this storage key" }, { status: 403 });
  }

  try {
    await createR2Client(config).send(
      new AbortMultipartUploadCommand({
        Bucket: config.bucket,
        Key: parsed.key,
        UploadId: parsed.uploadId,
      }),
    );
  } catch (error) {
    if (!isNoSuchUpload(error)) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Failed to abort multipart upload" },
        { status: 502 },
      );
    }
  }

  return Response.json({ ok: true });
}
