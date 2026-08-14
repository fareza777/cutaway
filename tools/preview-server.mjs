// A plain static file server for tools/preview.html.
//
//   node tools/preview-server.mjs
//
// The models are built headlessly and shipped into an APK, which means the
// first time anyone sees one is on a phone. That is a bad place to discover
// that a surface reads as a balloon. This serves the repo so the same .glb the
// app loads can be looked at in a browser first.

import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = process.cwd();
const PORT = 5179;
const TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.glb': 'model/gltf-binary',
  '.json': 'application/json',
};

createServer(async (request, response) => {
  const path = decodeURIComponent((request.url ?? '/').split('?')[0]);

  // The page renders offscreen and posts the frame here. Going through the
  // server rather than returning the image to the caller keeps a megabyte of
  // base64 out of everything that is not a file.
  if (request.method === 'POST' && path === '/shot') {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks).toString();
    const split = body.indexOf('\n');
    const name = body.slice(0, split).replace(/[^a-z0-9-]/gi, '');
    const dataUrl = body.slice(split + 1);
    await mkdir(join(ROOT, 'tools/shots'), { recursive: true });
    await writeFile(join(ROOT, 'tools/shots', `${name}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'));
    response.writeHead(200).end('ok');
    return;
  }

  const file = join(ROOT, normalize(path === '/' ? '/tools/preview.html' : path));
  if (!file.startsWith(ROOT)) {
    response.writeHead(403).end('no');
    return;
  }
  try {
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(body);
  } catch {
    response.writeHead(404).end('not found');
  }
}).listen(PORT, () => console.log(`preview on http://localhost:${PORT}`));
