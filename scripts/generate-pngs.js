// Generates valid PNG images using node:zlib and CRC32
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createCrcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
}

const crcTable = createCrcTable();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const crc = crc32(chunk.subarray(4, 8 + len));
  chunk.writeUInt32BE(crc, 8 + len);
  return chunk;
}

function generatePng(width, height, isMaskable = false) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Raw pixel data: each scanline starts with filter byte 0
  const bytesPerPixel = 4;
  const scanlineLength = 1 + width * bytesPerPixel;
  const rawData = Buffer.alloc(height * scanlineLength);

  const cx = width / 2;
  const cy = height / 2;
  const outerRadius = width * 0.46;
  const innerRadius = width * 0.36;

  for (let y = 0; y < height; y++) {
    const lineOffset = y * scanlineLength;
    rawData[lineOffset] = 0; // Filter None

    for (let x = 0; x < width; x++) {
      const pxOffset = lineOffset + 1 + x * bytesPerPixel;
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Base background: #0f172a (dark slate)
      let r = 15;
      let g = 23;
      let b = 42;
      let a = 255;

      if (!isMaskable) {
        // Rounded corner squircle
        const cornerRadius = width * 0.22;
        const cornerDistX = Math.max(0, Math.abs(x - cx) - (cx - cornerRadius));
        const cornerDistY = Math.max(0, Math.abs(y - cy) - (cy - cornerRadius));
        const cornerDist = Math.sqrt(cornerDistX * cornerDistX + cornerDistY * cornerDistY);
        if (cornerDist > cornerRadius) {
          a = 0;
        }
      }

      // Elegant inner scanner box pattern
      const boxSize = width * 0.55;
      const halfBox = boxSize / 2;
      const inBoxX = Math.abs(x - cx) <= halfBox;
      const inBoxY = Math.abs(y - cy) <= halfBox;
      const borderThick = Math.max(2, Math.round(width * 0.025));

      // QR border
      if (inBoxX && inBoxY) {
        const onBorder =
          Math.abs(Math.abs(x - cx) - halfBox) < borderThick ||
          Math.abs(Math.abs(y - cy) - halfBox) < borderThick;

        if (onBorder) {
          r = 56;
          g = 189;
          b = 248; // #38bdf8 sky blue
        } else {
          // Center symbol
          const centerDist = Math.sqrt(dx * dx + dy * dy);
          if (centerDist < width * 0.12) {
            r = 14;
            g = 165;
            b = 233; // bright blue
          } else if (
            (Math.abs(dx) < width * 0.18 && Math.abs(dy) < width * 0.04) ||
            (Math.abs(dy) < width * 0.18 && Math.abs(dx) < width * 0.04)
          ) {
            r = 248;
            g = 250;
            b = 252; // white crosshair
          }
        }
      }

      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', compressedData);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const outDir = path.resolve('public');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(path.join(outDir, 'pwa-192x192.png'), generatePng(192, 192, false));
fs.writeFileSync(path.join(outDir, 'pwa-512x512.png'), generatePng(512, 512, false));
fs.writeFileSync(path.join(outDir, 'pwa-maskable-512x512.png'), generatePng(512, 512, true));
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), generatePng(180, 180, false));
fs.writeFileSync(path.join(outDir, 'favicon.ico'), generatePng(64, 64, false));

console.log('PWA icons successfully generated in public/');
