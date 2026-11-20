// Read-only source review. All rendered/extracted artifacts go to a scratch directory.
import fs from "node:fs/promises";
import { pathToFileURL } from "node:url";
import path from "node:path";

const [input, output, runtime] = process.argv.slice(2);
if (!input || !output || !runtime) throw new Error("Usage: node scripts/review-exterior-amenity-pdf.mjs <pdf> <scratch> <pdfjs-node_modules>");
const canvas = await import(pathToFileURL(path.join(runtime, "@napi-rs/canvas/index.js")));
globalThis.DOMMatrix = canvas.DOMMatrix;
globalThis.ImageData = canvas.ImageData;
globalThis.Path2D = canvas.Path2D;
const pdfjs = await import(pathToFileURL(path.join(runtime, "pdfjs-dist/legacy/build/pdf.mjs")));
const pdf = await pdfjs.getDocument({ data: new Uint8Array(await fs.readFile(input)), useSystemFonts: true }).promise;
await fs.mkdir(output, { recursive: true });
for (const number of [9, 10]) {
  const page = await pdf.getPage(number);
  const viewport = page.getViewport({ scale: 2 });
  const surface = canvas.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  await page.render({ canvasContext: surface.getContext("2d"), viewport }).promise;
  await fs.writeFile(path.join(output, `page-${number}.png`), surface.toBuffer("image/png"));
  const text = (await page.getTextContent()).items.map(item => item.str).join("\n");
  await fs.writeFile(path.join(output, `page-${number}.txt`), text);
  console.log(`PAGE ${number}\n${text}`);
}
