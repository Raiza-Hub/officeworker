import { DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { z } from "zod";
import { getRedis } from "@/lib/redis";
import { createR2Client, getR2Config, requireOwnedStorageKey } from "../r2";

const keySchema = z
  .string()
  .trim()
  .startsWith("documents/")
  .max(300)
  .refine((key) => !key.includes(".."), "Invalid storage key");

const deleteObjectSchema = z.object({
  key: keySchema,
});

function isNotFound(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      (("name" in error && (error as { name?: string }).name === "NotFound") ||
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

  const requestUrl = new URL(request.url);
  const parsed = keySchema.safeParse(requestUrl.searchParams.get("key") ?? "");
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }

  if (!(await requireOwnedStorageKey(parsed.data))) {
    return Response.json({ error: "Not authorized for this storage key" }, { status: 403 });
  }

  try {
    await createR2Client(config).send(
      new HeadObjectCommand({ Bucket: config.bucket, Key: parsed.data }),
    );
    return Response.json({ exists: true });
  } catch (error) {
    if (isNotFound(error)) {
      return Response.json({ exists: false });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to check the object" },
      { status: 502 },
    );
  }
}

export async function DELETE(request: Request) {
  if (!(await isAuthenticatedNextjs())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const config = getR2Config();
  if (!config) {
    return Response.json({ error: "R2 is not configured" }, { status: 500 });
  }

  let parsed: z.infer<typeof deleteObjectSchema>;
  try {
    parsed = deleteObjectSchema.parse(await request.json());
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
      new DeleteObjectCommand({ Bucket: config.bucket, Key: parsed.key }),
    );

    const redis = getRedis();
    if (redis) {
      try {
        await redis.del(
          `preview:view:${parsed.key}`,
          `preview:dl:${parsed.key}`,
        );
      } catch (error) {
        console.warn("Preview URL cache invalidation failed", error);
      }
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to delete the object" },
      { status: 502 },
    );
  }
}
