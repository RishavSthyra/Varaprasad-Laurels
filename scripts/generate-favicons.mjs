import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

// Reuse the exact framed gold mark displayed at the top of DesktopSiteRail.
const source = new URL("../public/vp_cons_images_Cropped.webp", import.meta.url);
const logo = await readFile(source);
const background = "#00142b";

async function renderIcon(size) {
  const padding = Math.max(1, Math.round(size * 0.05));
  const mark = await sharp(logo)
    .resize(size - padding * 2, size - padding * 2, { fit: "inside" })
    .png()
    .toBuffer();

  return sharp({
    create: { width: size, height: size, channels: 4, background },
  }).composite([{ input: mark, gravity: "centre" }]).png().toBuffer();
}

// ICO supports PNG-encoded frames. Include small native sizes and a 256px frame.
const sizes = [16, 32, 48, 64, 128, 256];
const frames = await Promise.all(sizes.map(renderIcon));
const directory = Buffer.alloc(6 + sizes.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(sizes.length, 4);
let offset = directory.length;
sizes.forEach((size, index) => {
  const entry = 6 + index * 16;
  directory[entry] = size === 256 ? 0 : size;
  directory[entry + 1] = size === 256 ? 0 : size;
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(frames[index].length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += frames[index].length;
});

await Promise.all([
  writeFile(new URL("../app/favicon.ico", import.meta.url), Buffer.concat([directory, ...frames])),
  writeFile(new URL("../public/favicon.png", import.meta.url), frames[sizes.indexOf(64)]),
  renderIcon(180).then((image) => writeFile(new URL("../public/apple-touch-icon.png", import.meta.url), image)),
]);
console.log("Generated sidebar-logo favicon.ico, favicon.png and apple-touch-icon.png.");
