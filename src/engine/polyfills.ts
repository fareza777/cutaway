/**
 * Hermes does not ship TextDecoder, and GLTFLoader uses it to read the JSON
 * chunk out of a .glb. Rather than pull in a polyfill package for one call
 * site, decode UTF-8 by hand — the input is always well-formed JSON produced by
 * our own build step or an exporter.
 */

type MinimalTextDecoder = { decode(input?: ArrayBufferView | ArrayBuffer): string };

function decodeUtf8(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  // Chunked so a large model does not blow the argument limit on fromCharCode.
  const codes: number[] = [];
  while (i < bytes.length) {
    const byte = bytes[i++];
    let code: number;
    if (byte < 0x80) {
      code = byte;
    } else if (byte < 0xe0) {
      code = ((byte & 0x1f) << 6) | (bytes[i++] & 0x3f);
    } else if (byte < 0xf0) {
      code = ((byte & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
    } else {
      code =
        ((byte & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
      code -= 0x10000;
      codes.push(0xd800 + (code >> 10), 0xdc00 + (code & 0x3ff));
      if (codes.length > 8192) {
        out += String.fromCharCode(...codes);
        codes.length = 0;
      }
      continue;
    }
    codes.push(code);
    if (codes.length > 8192) {
      out += String.fromCharCode(...codes);
      codes.length = 0;
    }
  }
  return out + String.fromCharCode(...codes);
}

export function installPolyfills() {
  const scope = globalThis as unknown as { TextDecoder?: unknown };
  if (typeof scope.TextDecoder !== 'undefined') return;

  scope.TextDecoder = class TextDecoderShim implements MinimalTextDecoder {
    decode(input?: ArrayBufferView | ArrayBuffer): string {
      if (!input) return '';
      const bytes =
        input instanceof ArrayBuffer
          ? new Uint8Array(input)
          : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
      return decodeUtf8(bytes);
    }
  };
}
