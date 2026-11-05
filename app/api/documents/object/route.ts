import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { isAuthenticatedNextjs } from "@convex-dev/auth/nextjs/server";
import { z } from "zod";
import { createR2Client, getR2Config } from "../r2";

const deleteObjectSchema = z.object({
  key: z
    .string()
    .trim()
    .startsWith("documents/")
    .max(300)
    .refine((key) => !key.includes(".."), "Invalid storage key"),
});

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

  try {
    await createR2Client(config).send(
      new DeleteObjectCommand({ Bucket: config.bucket, Key: parsed.key }),
    );
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to delete the object" },
      { status: 502 },
    );
  }
}
