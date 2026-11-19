// Read-only CAD inspection. Input is dxf-parser JSON; output goes to an explicitly supplied scratch directory.
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("Usage: node scripts/inspect-laurels-landscape.mjs <parsed.json> <scratch-directory>");
const cad = JSON.parse(await fs.readFile(input, "utf8"));
const lines = [], labels = [];
const identity = [1, 0, 0, 1, 0, 0];
const point = (p, m) => ({ x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] });
const compose = (a, b) => [a[0]*b[0]+a[2]*b[1], a[1]*b[0]+a[3]*b[1], a[0]*b[2]+a[2]*b[3], a[1]*b[2]+a[3]*b[3], a[0]*b[4]+a[2]*b[5]+a[4], a[1]*b[4]+a[3]*b[5]+a[5]];
function walk(entities, matrix = identity, ancestry = []) {
  for (const e of entities) {
    if (e.type === "INSERT") {
      if (ancestry.includes(e.name) || ancestry.length > 15) continue;
      const block = cad.blocks[e.name];
      if (!block) continue;
      const angle = (e.rotation ?? 0) * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
      const sx = e.xScale ?? 1, sy = e.yScale ?? 1, base = block.position ?? { x: 0, y: 0 };
      const local = [c*sx, s*sx, -s*sy, c*sy, e.position.x-c*sx*base.x+s*sy*base.y, e.position.y-s*sx*base.x-c*sy*base.y];
      walk(block.entities ?? [], compose(matrix, local), [...ancestry, e.name]);
    } else if (/TEXT|ATTRIB/.test(e.type)) {
      const p = e.startPoint ?? e.position;
      if (p) labels.push({ text: e.text ?? e.string ?? e.value, point: point(p, matrix), layer: e.layer, handle: e.handle, ancestry });
    } else {
      let vertices = [];
      if (e.type === "LINE") vertices = e.vertices ?? [e.start, e.end].filter(Boolean);
      if (/POLYLINE/.test(e.type)) vertices = [...(e.vertices ?? [])];
      if (e.type === "CIRCLE" || e.type === "ARC") {
        const from = e.type === "CIRCLE" ? 0 : e.startAngle;
        let to = e.type === "CIRCLE" ? Math.PI*2 : e.endAngle;
        if (to < from) to += Math.PI*2;
        vertices = Array.from({ length: 33 }, (_, i) => ({ x: e.center.x+Math.cos(from+(to-from)*i/32)*e.radius, y: e.center.y+Math.sin(from+(to-from)*i/32)*e.radius }));
      }
      if (vertices.length > 1) {
        if (e.shape && /POLYLINE/.test(e.type)) vertices.push(vertices[0]);
        lines.push({ points: vertices.map(p => point(p, matrix)), layer: e.layer, handle: e.handle, ancestry });
      }
    }
  }
}
walk(cad.entities);
await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(output, "landscape-flat.json"), JSON.stringify({ lines, labels }));
// Current layout extents, excluding the legacy xref's distant drawing sheets.
const bounds = { left: 50000, right: 520000, bottom: 70000, top: 480000 };
const width = 1800, height = Math.round(width*(bounds.top-bounds.bottom)/(bounds.right-bounds.left));
const px = p => [(p.x-bounds.left)*width/(bounds.right-bounds.left), (bounds.top-p.y)*height/(bounds.top-bounds.bottom)];
const escape = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const paths = lines.map(l => `<polyline points="${l.points.map(p=>px(p).join(",")).join(" ")}" fill="none" stroke="${/SPORTS|EPDM/.test(l.layer)?"#c0392b":"#8b949a"}" stroke-width="${/BOUNDARY|BOUNDRY/.test(l.layer)?1.4:0.7}"/>`).join("");
const relevant = labels.filter(l => /CLUB|TOT.LOT|PARK|POOL|COURT|MULTIPURPOSE|ENTRY|EXIT/i.test(l.text) && !/CAR.?PARKING|FABRICATED/.test(l.text));
const texts = relevant.map(l => { const [x,y]=px(l.point); return `<circle cx="${x}" cy="${y}" r="3" fill="#163cbd"/><text x="${x+5}" y="${y-4}" font-size="10" fill="#163cbd">${escape(l.text)}</text>`; }).join("");
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/>${paths}${texts}</svg>`;
await sharp(Buffer.from(svg)).png().toFile(path.join(output, "landscape.png"));
console.log(JSON.stringify({ output, lines: lines.length, labels: labels.length, amenities: relevant }, null, 2));
