import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { z } from "zod";
import { createR2Client, getR2Config } from "../../documents/r2";

const PREVIEW_TTL_SECONDS = 3600;

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

  try {
    const url = await getSignedUrl(
      createR2Client(config),
      new GetObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ...(download
          ? {
              ResponseContentDisposition: `attachment; filename="${(key.split("/").pop() ?? "file").replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
            }
          : {}),
      }),
      { expiresIn: PREVIEW_TTL_SECONDS },
    );
    const filename = key.split("/").pop() ?? "file";
    return Response.json({ url, filename });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to sign URL" },
      { status: 502 },
    );
  }
}
