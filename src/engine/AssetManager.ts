/**
 * Loads .glb files that ship inside the app.
 *
 * Offline-first is not a feature here, it is the only mode: models are bundled
 * assets, expo-asset copies them to local storage on first use, and nothing
 * ever touches the network. A small LRU keeps recently visited objects parsed
 * so returning to one is instant.
 */

import * as THREE from 'three';
import { Platform } from 'react-native';
import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { installPolyfills } from './polyfills';

installPolyfills();

const CACHE_LIMIT = 2;

/**
 * Turns a promise that may never settle into one that always does.
 *
 * A native call that hangs is indistinguishable from a slow one, and the screen
 * above this has only two states — loading, or loaded. Without this, a stuck
 * read leaves a spinner up forever with nothing in the logs. Better to fail
 * loudly and say which file and which step.
 */
function readFile(uri: string): Promise<ArrayBuffer> {
  return new File(uri).arrayBuffer();
}

async function readFetch(uri: string): Promise<ArrayBuffer> {
  const response = await fetch(uri);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.arrayBuffer();
}

function describe(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function withTimeout<T>(promise: Promise<T>, ms: number, what: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Timed out ${what}`)), ms);
    }),
  ]).finally(() => clearTimeout(timer)) as Promise<T>;
}

export class AssetManager {
  private loader = new GLTFLoader();
  private cache = new Map<string, ArrayBuffer>();
  private inflight = new Map<string, Promise<ArrayBuffer>>();

  /**
   * Returns a fresh scene graph every call. Buffers are cached, not scene
   * graphs: an Assembly re-parents and mutates what it is given, so handing the
   * same graph out twice would corrupt the second use.
   */
  async load(id: string, moduleId: number): Promise<GLTF> {
    const buffer = await this.buffer(id, moduleId);
    // GLTFLoader keeps a reference to the ArrayBuffer it parses, so give it a
    // copy and leave the cached original untouched.
    //
    // The parse is inside the timeout as well as the read. GLTFLoader resolves
    // through an internal promise graph, and if any node of it never settles
    // the whole load hangs with nothing thrown and nothing logged — which is
    // indistinguishable, from the outside, from a slow file read.
    return withTimeout(this.loader.parseAsync(buffer.slice(0), ''), 20_000, `parsing ${id}`);
  }

  private buffer(id: string, moduleId: number): Promise<ArrayBuffer> {
    const cached = this.cache.get(id);
    if (cached) {
      this.cache.delete(id);
      this.cache.set(id, cached);
      return Promise.resolve(cached);
    }

    const existing = this.inflight.get(id);
    if (existing) return existing;

    const pending = this.read(moduleId)
      .then((buffer) => {
        this.cache.set(id, buffer);
        this.evict();
        return buffer;
      })
      .finally(() => this.inflight.delete(id));

    this.inflight.set(id, pending);
    return pending;
  }

  private async read(moduleId: number): Promise<ArrayBuffer> {
    const asset = Asset.fromModule(moduleId);

    // Always download, never conditionally. For an asset embedded in the APK,
    // expo-asset deliberately reports localUri as null and puts an
    // android_res/android_asset URL in `uri` — a path no file API can open.
    // downloadAsync is what materialises it into the cache directory as a real
    // file. Skipping that call when localUri happened to be set was the bug
    // that left the loading spinner up forever on device.
    await withTimeout(asset.downloadAsync(), 20_000, 'preparing the model file');

    const uri = asset.localUri ?? asset.uri;
    if (!uri) throw new Error('model asset resolved to no uri');

    // Which reader works depends on how the app was built, and the two cases
    // are hard to tell apart from the URI alone: a release APK yields a cached
    // file path, Metro yields an http URL, and web yields a relative one. Rather
    // than predict it, try the likely one and fall back — a wrong guess here
    // costs a whole rebuild to discover.
    const preferFile = Platform.OS !== 'web' && uri.startsWith('file://');
    const readers = preferFile ? [readFile, readFetch] : [readFetch, readFile];

    let firstError: unknown;
    for (const reader of readers) {
      try {
        return await withTimeout(reader(uri), 20_000, `reading ${uri}`);
      } catch (error) {
        firstError ??= error;
      }
    }
    throw new Error(`Could not read ${uri} — ${describe(firstError)}`);
  }


  private evict() {
    while (this.cache.size > CACHE_LIMIT) {
      const oldest = this.cache.keys().next().value;
      if (oldest === undefined) return;
      this.cache.delete(oldest);
    }
  }

  dispose() {
    this.cache.clear();
    this.inflight.clear();
    THREE.Cache.clear();
  }
}
