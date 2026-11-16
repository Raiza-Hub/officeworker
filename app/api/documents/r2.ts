import { S3Client } from "@aws-sdk/client-s3";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

export type R2Config = {
  accountId: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export function getR2Config(): R2Config | undefined {
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) return undefined;
  return { accountId, bucket, accessKeyId, secretAccessKey };
}

export function createR2Client(config: R2Config): S3Client {
  return new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

export async function requireOwnedStorageKey(storageKey: string): Promise<boolean> {
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) return false;
  const token = await convexAuthNextjsToken();
  if (!token) return false;
  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);
  const docId = await client.query(api.documents.getOwnedIdByStorageKey, { storageKey });
  return docId !== null;
}
