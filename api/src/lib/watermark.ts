import sharp from "sharp";

/**
 * Applies a semi-transparent text watermark to the bottom-right corner of
 * the image. Called on every Freemium-tier render to differentiate paid output.
 *
 * Phase 7 replaces the text overlay with a brand-approved PNG; the swap is a
 * one-line change in this file.
 */
export async function applyWatermark(input: Buffer): Promise<Buffer> {
  const metadata = await sharp(input).metadata();
  const width = metadata.width ?? 1024;
  const height = metadata.height ?? 1024;

  const fontSize = Math.max(24, Math.floor(width / 28));
  const padding = Math.floor(width / 30);
  const strokeWidth = Math.max(1, Math.floor(fontSize / 16));

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <text
      x="${width - padding}"
      y="${height - padding}"
      font-family="Arial, sans-serif"
      font-size="${fontSize}"
      font-weight="800"
      text-anchor="end"
      fill="white"
      fill-opacity="0.6"
      stroke="black"
      stroke-width="${strokeWidth}"
      stroke-opacity="0.45"
    >PRHOMZ AI • Freemium</text>
  </svg>`;

  return sharp(input)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
}
