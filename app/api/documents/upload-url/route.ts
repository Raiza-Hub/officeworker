import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { z } from "zod";

const UPLOAD_TTL_SECONDS = 900;
const MAX_FILE_SIZE_BYTES = 100 * 1024 * 1024;
const MAX_KEY_NAME_LENGTH = 200;

const uploadUrlRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(512),
  fileType: z.string().trim().min(1).max(255),
  fileSize: z.number().int().positive().max(MAX_FILE_SIZE_BYTES),
});

type R2Config = {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

function getR2Config(): R2Config | undefined {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) return undefined;
  return { accountId, bucket, accessKeyId, secretAccessKey };
}

function presignKey(fileName: string): string {
  const sanitized = fileName
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  const base = sanitized.length > 0 ? sanitized : "file";
  return base.slice(-MAX_KEY_NAME_LENGTH);
}

export async function POST(request: Request) {
  if (!(await isAuthenticatedNextjs())) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env["R2_ACCOUNT_ID"]) {
    return Response.json(
      {
        error:
          "R2 is not configured. Set R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY in .env.local.",
      },
      { status: 500 },
    );
  }

  let parsed: z.infer<typeof uploadUrlRequestSchema>;
  try {
    parsed = uploadUrlRequestSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
    }
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const config = getR2Config();
  if (!config) {
    return Response.json({ error: "R2 credentials are incomplete in environment configuration" }, { status: 500 });
  }

  const key = `documents/${crypto.randomUUID()}-${presignKey(parsed.fileName)}`;
  try {
    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
    const url = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: key,
        ContentType: parsed.fileType,
      }),
      { expiresIn: UPLOAD_TTL_SECONDS },
    );
    return Response.json({ url, key });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to create the upload URL" },
      { status: 502 },
    );
  }
}
