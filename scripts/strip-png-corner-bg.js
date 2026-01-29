/* Strips a uniform corner-connected background from a PNG by flood-filling from corners
 * and setting matching pixels' alpha to 0.
 *
 * Usage:
 *   node scripts/strip-png-corner-bg.js assets/images/wordle-icon.png
 */

const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const inputPath = process.argv[2];
if (!inputPath) {
  console.error(
    "Missing input PNG path. Example: node scripts/strip-png-corner-bg.js assets/images/wordle-icon.png",
  );
  process.exit(1);
}

const resolved = path.resolve(process.cwd(), inputPath);
let buffer = fs.readFileSync(resolved);

function trimToIend(buf) {
  // Some PNGs may have extra bytes after the IEND chunk; pngjs rejects that.
  // This trims to the end of IEND so the PNG parser can read it.
  if (buf.length < 8) return buf;
  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!buf.subarray(0, 8).equals(PNG_SIG)) return buf;
  let offset = 8;
  while (offset + 8 <= buf.length) {
    const length = buf.readUInt32BE(offset);
    const type = buf.subarray(offset + 4, offset + 8).toString("ascii");
    const chunkTotal = 12 + length;
    const next = offset + chunkTotal;
    if (next > buf.length) break;
    if (type === "IEND") return buf.subarray(0, next);
    offset = next;
  }
  return buf;
}

buffer = trimToIend(buffer);

function getPixel(png, x, y) {
  const idx = (png.width * y + x) << 2;
  return {
    r: png.data[idx],
    g: png.data[idx + 1],
    b: png.data[idx + 2],
    a: png.data[idx + 3],
  };
}

function setAlpha(png, x, y, a) {
  const idx = (png.width * y + x) << 2;
  png.data[idx + 3] = a;
}

function colorDist(c1, c2) {
  return (
    Math.abs(c1.r - c2.r) +
    Math.abs(c1.g - c2.g) +
    Math.abs(c1.b - c2.b) +
    Math.abs(c1.a - c2.a)
  );
}

const TOL = Number(process.env.PNG_BG_TOL ?? 60);

const png = PNG.sync.read(buffer);

const corners = [
  { x: 0, y: 0 },
  { x: png.width - 1, y: 0 },
  { x: 0, y: png.height - 1 },
  { x: png.width - 1, y: png.height - 1 },
];

const cornerColors = corners.map(({ x, y }) => getPixel(png, x, y));
// Choose a representative corner background color.
// Prefer the one with the highest alpha (most likely the visible background).
let bg = cornerColors[0];
for (const c of cornerColors) {
  if (c.a > bg.a) bg = c;
}

console.log("Input:", inputPath);
console.log("Size:", png.width, "x", png.height);
console.log("Corner alphas (before):", cornerColors.map((c) => c.a).join(", "));
console.log("Using BG RGBA:", bg);
console.log("Tolerance:", TOL);

const visited = new Uint8Array(png.width * png.height);
const qx = [];
const qy = [];

function enqueue(x, y) {
  const i = y * png.width + x;
  if (visited[i]) return;
  visited[i] = 1;
  qx.push(x);
  qy.push(y);
}

for (const { x, y } of corners) enqueue(x, y);

let cleared = 0;
while (qx.length) {
  const x = qx.pop();
  const y = qy.pop();

  const px = getPixel(png, x, y);
  if (px.a === 0) {
    // Already transparent; still propagate because bg may already be stripped.
  } else if (colorDist(px, bg) <= TOL) {
    setAlpha(png, x, y, 0);
    cleared++;
  } else {
    continue;
  }

  // 4-neighborhood
  if (x > 0) enqueue(x - 1, y);
  if (x + 1 < png.width) enqueue(x + 1, y);
  if (y > 0) enqueue(x, y - 1);
  if (y + 1 < png.height) enqueue(x, y + 1);
}

const outBuffer = PNG.sync.write(png);
fs.writeFileSync(resolved, outBuffer);

const afterCornerAlphas = corners.map(({ x, y }) => getPixel(png, x, y).a);
console.log("Cleared pixels:", cleared);
console.log("Corner alphas (after):", afterCornerAlphas.join(", "));
console.log("Done (in-place).\n");
