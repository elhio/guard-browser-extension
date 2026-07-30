import { createC2pa, type C2paSdk } from '@contentauth/c2pa-web';
import { browser } from 'wxt/browser';
import wasmSrc from '@contentauth/c2pa-web/resources/c2pa.wasm?url';
import workerUrl from '@contentauth/c2pa-web/c2pa_worker?url';

let c2paInstance: Promise<C2paSdk> | undefined;

/**
 * Resolves the packaged c2pa worker to an absolute extension URL.
 *
 * Left to itself, c2pa-web spawns its WASM worker from an inline `blob:` URL (with a `data:` fallback).
 * Neither works inside the extension: Chrome's MV3 CSP blocks blob/data workers (`worker-src` falls back
 * to `script-src 'self'`), and WebKit refuses to load a worker from a blob URL at all ("WebKitBlobResource
 * error 1"). Both hang `createC2pa` indefinitely. Pointing `workerSrc` at the worker shipped as a
 * same-origin extension asset sidesteps both, since a worker at the extension's own origin is `'self'`.
 *
 * The resulting URL uses the extension scheme (`chrome-extension:`/`moz-extension:`/`safari-web-extension:`);
 * c2pa-web's built-in `https:`-only guard on the worker URL is widened to accept those schemes by the
 * `c2pa-allow-extension-worker-url` Vite transform in `wxt.config.ts`.
 *
 * `getURL` must be read off `browser.runtime` at call time (see the note in localModel/runner.ts):
 * detaching it returns `undefined` on Safari. The cast widens the type because WXT types `getURL` against
 * a union of known public paths that doesn't include the hashed worker asset.
 */
function getWorkerSrc(): URL {
  return new URL((browser.runtime.getURL as (assetPath: string) => string)(workerUrl));
}

/**
 * Initializes and retrieves a singleton instance of the C2PA Web SDK
 *
 * @returns A promise that resolves to the fully initialized `C2paSdk` instance ready for manifest reading
 */
export function getC2pa(): Promise<C2paSdk> {
  if (!c2paInstance) {
    c2paInstance = createC2pa({ wasmSrc, workerSrc: getWorkerSrc() });
  }
  return c2paInstance;
}