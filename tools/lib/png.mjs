// A minimal PNG encoder.
//
// The app needs an icon and a splash mark, and both should be generated from
// the same arithmetic that draws everything else here rather than being binary
// blobs nobody can regenerate. Node ships zlib, which is the only hard part of
// writing a PNG; the rest is four chunks and a CRC.

import { deflateSync } from 'node:zlib';

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) c = CRC_TABLE[(c ^ buffer[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([length, body, crc]);
}

/** `pixels` is RGBA, 4 bytes per pixel, row-major from the top. */
export function encodePng(pixels, width, height) {
  const stride = width * 4;
  // Each scanline is prefixed with its filter type; 0 means "none", which
  // deflate handles well enough for flat, synthetic artwork.
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    pixels.copy
      ? pixels.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
      : Buffer.from(pixels.buffer, y * stride, stride).copy(raw, y * (stride + 1) + 1);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** A tiny RGBA canvas with the handful of primitives the brand mark needs. */
export class Bitmap {
  constructor(size, background = [0, 0, 0, 0]) {
    this.size = size;
    this.data = Buffer.alloc(size * size * 4);
    for (let i = 0; i < this.data.length; i += 4) {
      this.data[i] = background[0];
      this.data[i + 1] = background[1];
      this.data[i + 2] = background[2];
      this.data[i + 3] = background[3];
    }
  }

  /** Alpha-composites one pixel. `a` is 0–1. */
  blend(x, y, [r, g, b], a) {
    if (a <= 0 || x < 0 || y < 0 || x >= this.size || y >= this.size) return;
    const i = (y * this.size + x) * 4;
    const dst = this.data[i + 3] / 255;
    const out = a + dst * (1 - a);
    if (out <= 0) return;
    this.data[i] = (r * a + this.data[i] * dst * (1 - a)) / out;
    this.data[i + 1] = (g * a + this.data[i + 1] * dst * (1 - a)) / out;
    this.data[i + 2] = (b * a + this.data[i + 2] * dst * (1 - a)) / out;
    this.data[i + 3] = out * 255;
  }

  /**
   * Fills every pixel whose distance from the centre falls inside
   * [inner, outer], optionally limited to an angular wedge. Antialiased by
   * sampling the distance against a half-pixel band, which is all this artwork
   * needs — the shapes are circles.
   */
  ring(inner, outer, colour, { from = -Math.PI, to = Math.PI, alpha = 1 } = {}) {
    const c = (this.size - 1) / 2;
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        const dx = x - c;
        const dy = y - c;
        const d = Math.hypot(dx, dy);
        if (d > outer + 1 || d < inner - 1) continue;

        let angle = Math.atan2(dy, dx);
        if (angle < from || angle > to) continue;

        const edge = Math.min(outer - d, d - inner);
        const coverage = Math.max(0, Math.min(1, edge + 0.5));
        this.blend(x, y, colour, coverage * alpha);
      }
    }
  }

  toPng() {
    return encodePng(this.data, this.size, this.size);
  }

  /** Nearest-neighbour box downscale, for generating the smaller sizes. */
  resized(size) {
    const out = new Bitmap(size);
    const ratio = this.size / size;
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        let r = 0, g = 0, b = 0, a = 0, n = 0;
        const x0 = Math.floor(x * ratio);
        const y0 = Math.floor(y * ratio);
        const x1 = Math.max(x0 + 1, Math.floor((x + 1) * ratio));
        const y1 = Math.max(y0 + 1, Math.floor((y + 1) * ratio));
        for (let sy = y0; sy < y1; sy += 1) {
          for (let sx = x0; sx < x1; sx += 1) {
            const i = (sy * this.size + sx) * 4;
            const sa = this.data[i + 3] / 255;
            r += this.data[i] * sa;
            g += this.data[i + 1] * sa;
            b += this.data[i + 2] * sa;
            a += sa;
            n += 1;
          }
        }
        const o = (y * size + x) * 4;
        out.data[o] = a > 0 ? r / a : 0;
        out.data[o + 1] = a > 0 ? g / a : 0;
        out.data[o + 2] = a > 0 ? b / a : 0;
        out.data[o + 3] = (a / n) * 255;
      }
    }
    return out;
  }
}
