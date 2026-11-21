/** Remove only near-white pixels connected to the outside of an RGBA image.
 * Four-connected flood fill cannot jump across walls to isolated white rooms.
 * The original RGB values, alpha elsewhere and complete canvas are retained.
 */
export function maskOuterFloorPlanBackground(source, width, height, {
  minimum = 245, spread = 12, smoothMinimum = 245, smoothSpread = 45, smoothDifference = 8,
} = {}) {
  if (source.length !== width * height * 4) throw new Error("Expected an RGBA floor plan");
  const count = width * height;
  const mask = new Uint8Array(count);
  const queue = new Uint32Array(count);
  let head = 0, tail = 0, removed = 0;
  const enqueue = index => {
    if (mask[index]) return;
    const pixel = index * 4;
    const low = Math.min(source[pixel], source[pixel + 1], source[pixel + 2]);
    const high = Math.max(source[pixel], source[pixel + 1], source[pixel + 2]);
    if (source[pixel + 3] !== 0 && (low < minimum || high - low > spread)) {
      if (low < smoothMinimum || high - low > smoothSpread) return;
      // Smooth off-white render backdrops/shadows are different from textured
      // stone terraces. Keep texture and high-contrast footprint/wall edges.
      const x = index % width, y = Math.floor(index / width);
      for (const neighbour of [
        y * width + Math.max(0, x - 2), y * width + Math.min(width - 1, x + 2),
        Math.max(0, y - 2) * width + x, Math.min(height - 1, y + 2) * width + x,
      ]) {
        for (let channel = 0; channel < 3; channel++) {
          if (Math.abs(source[pixel + channel] - source[neighbour * 4 + channel]) > smoothDifference) return;
        }
      }
    }
    mask[index] = 1;
    queue[tail++] = index;
  };
  for (let x = 0; x < width; x++) { enqueue(x); enqueue((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { enqueue(y * width); enqueue(y * width + width - 1); }
  while (head < tail) {
    const index = queue[head++], x = index % width, y = Math.floor(index / width);
    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (y > 0) enqueue(index - width);
    if (y + 1 < height) enqueue(index + width);
  }
  const pixels = Buffer.from(source);
  for (let index = 0; index < count; index++) {
    if (!mask[index]) continue;
    if (pixels[index * 4 + 3] > 0) removed++;
    pixels[index * 4 + 3] = 0;
  }
  return { pixels, mask, removed };
}
