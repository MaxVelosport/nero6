import { randomUUID } from "crypto";
import { objectStorageClient } from "./objectStorage.js";

function parseGcsPath(fullPath: string): { bucketName: string; objectName: string } {
  if (fullPath.startsWith("gs://")) {
    const withoutScheme = fullPath.slice(5);
    const slashIdx = withoutScheme.indexOf("/");
    return {
      bucketName: withoutScheme.slice(0, slashIdx),
      objectName: withoutScheme.slice(slashIdx + 1),
    };
  }
  throw new Error(`Invalid GCS path: ${fullPath}`);
}

export async function saveImageFromUrl(
  imageUrl: string,
  subdir: string = "illustrations"
): Promise<string> {
  const privateObjectDir = process.env.PRIVATE_OBJECT_DIR;
  if (!privateObjectDir) throw new Error("PRIVATE_OBJECT_DIR not set");

  const resp = await fetch(imageUrl);
  if (!resp.ok) throw new Error(`Failed to download image: ${resp.status}`);
  const buffer = Buffer.from(await resp.arrayBuffer());

  const objectId = randomUUID();
  const fullPath = `${privateObjectDir}/${subdir}/${objectId}.png`;
  const { bucketName, objectName } = parseGcsPath(fullPath);

  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(objectName);

  await file.save(buffer, {
    contentType: "image/png",
    metadata: { cacheControl: "public, max-age=31536000" },
  });

  return `/objects/${subdir}/${objectId}.png`;
}
