import { createC2pa, type C2paSdk } from '@contentauth/c2pa-web';
import { browser } from 'wxt/browser';
import wasmUrl from '@contentauth/c2pa-web/resources/c2pa.wasm?url';
import workerUrl from '@contentauth/c2pa-web/c2pa_worker?url';

/**
 * How long to wait for the SDK to come up before giving up
 */
const INIT_TIMEOUT_MS = 20_000;

let c2paInstance: Promise<C2paSdk> | undefined;

/**
 * Resolves a bundled asset to an absolute extension URL
 */
function getAssetUrl(assetPath: string): string {
  return (browser.runtime.getURL as (assetPath: string) => string)(assetPath);
}

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
 */
function getWorkerSrc(): URL {
  return new URL(getAssetUrl(workerUrl));
}

async function fetchWasm(url: string): Promise<Response> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch C2PA wasm (HTTP ${response.status}) from ${url}`);
  }
  return response;
}

/**
 * Fetches and compiles the WASM binary ourselves instead of handing c2pa-web its URL
 *
 * Given a string `wasmSrc`, c2pa-web loads it as `fetch(url, { integrity })` +
 * `WebAssembly.compileStreaming(response)`. Both halves are hazards inside an extension, where the
 * bytes are served from the packaged bundle rather than by a web server we configure:
 * `compileStreaming` rejects unless the response carries `Content-Type: application/wasm`, and SRI is
 * specified over HTTP(S) responses, not over a `safari-web-extension:` scheme. Either rejection lands
 * in the caller's `catch` in readManifest.ts, which is how a WebKit-only failure here reads as
 * "no C2PA manifest" instead of an error. `Config.wasmSrc` also accepts an already-compiled module,
 * which lets us do the load on our own terms; dropping the integrity check costs nothing, since the
 * bytes come from our own bundle rather than the network.
 *
 * Streaming is still attempted first so the common path stays a single pass with no full-buffer copy;
 * the fallback only pays for itself where streaming can't work, and logs which case this browser is.
 */
async function compileWasm(): Promise<WebAssembly.Module> {
  const url = getAssetUrl(wasmUrl);
  const response = await fetchWasm(url);
  try {
    return await WebAssembly.compileStreaming(response);
  } catch (error) {
    console.warn(
      `[Guard c2pa] streaming wasm compile failed (content-type=${
        response.headers.get('content-type') ?? '(none)'
      }), falling back to buffered compile:`,
      error
    );
    return WebAssembly.compile(await (await fetchWasm(url)).arrayBuffer());
  }
}

async function initC2pa(): Promise<C2paSdk> {
  const startedAt = Date.now();
  const sdk = await createC2pa({ wasmSrc: await compileWasm(), workerSrc: getWorkerSrc() });
  console.debug(`[Guard c2pa] SDK ready in ${Date.now() - startedAt}ms`);
  return sdk;
}

/**
 * Initializes and retrieves a singleton instance of the C2PA Web SDK
 *
 * A failed init clears the cached promise: without that, one transient failure is memoized and
 * silently disables C2PA for the remaining lifetime of the offscreen document.
 *
 * @returns A promise that resolves to the fully initialized `C2paSdk` instance ready for manifest reading
 */
export function getC2pa(): Promise<C2paSdk> {
  if (!c2paInstance) {
    const started = withInitTimeout(initC2pa());
    c2paInstance = started.catch((error: unknown) => {
      c2paInstance = undefined;
      throw error;
    });
  }
  return c2paInstance;
}

/**
 * Rejects if the SDK doesn't come up in time, disposing it if it turns up afterwards
 *
 * `createC2pa` can't be cancelled, so a timed-out init keeps going and eventually lands a live SDK
 * that nobody holds a reference to. Since a failed init clears the singleton, the next image starts a
 * fresh one — on a browser where init is genuinely slow rather than broken, that would accumulate an
 * orphaned worker and its 8 MB wasm instance per retry.
 */
function withInitTimeout(promise: Promise<C2paSdk>): Promise<C2paSdk> {
  return new Promise<C2paSdk>((resolve, reject) => {
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      reject(new Error(`C2PA SDK init timed out after ${INIT_TIMEOUT_MS}ms`));
    }, INIT_TIMEOUT_MS);

    promise.then(
      (sdk) => {
        clearTimeout(timer);
        if (timedOut) {
          sdk.dispose();
          return;
        }
        resolve(sdk);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    );
  });
}
