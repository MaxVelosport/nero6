import { randomUUID } from "crypto";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { fetch as undiciFetch, ProxyAgent } from "undici";

const UPLOADS_DIR = process.env.UPLOADS_DIR ?? "/home/deploy/data/uploads";

export async function saveImageFromUrl(
  imageUrl: string,
  subdir: string = "illustrations"
): Promise<string> {
  const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
  const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;

  let resp: Awaited<ReturnType<typeof undiciFetch>>;
  try {
    resp = await undiciFetch(imageUrl, { dispatcher } as any);
  } catch (fetchErr) {
    console.error(`[imageSave] fetch failed for ${imageUrl}:`, fetchErr);
    throw fetchErr;
  }

  if (!resp.ok) {
    const msg = `[imageSave] HTTP ${resp.status} downloading ${imageUrl}`;
    console.error(msg);
    throw new Error(msg);
  }

  const buffer = Buffer.from(await resp.arrayBuffer());

  const dir = path.join(UPLOADS_DIR, subdir);
  await mkdir(dir, { recursive: true });

  const filename = `${randomUUID()}.png`;
  const filePath = path.join(dir, filename);
  try {
    await writeFile(filePath, buffer);
  } catch (writeErr) {
    console.error(`[imageSave] writeFile failed at ${filePath}:`, writeErr);
    throw writeErr;
  }

  console.log(`[imageSave] saved ${buffer.length} bytes → ${filePath}`);
  return `/uploads/${subdir}/${filename}`;
}
