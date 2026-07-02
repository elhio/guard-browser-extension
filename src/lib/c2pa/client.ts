import { createC2pa, type C2paSdk } from '@contentauth/c2pa-web';
import wasmSrc from '@contentauth/c2pa-web/resources/c2pa.wasm?url';

let c2paInstance: Promise<C2paSdk> | undefined;

/**
 * Lazily creates a single shared C2pa SDK instance (loads the wasm module once).
 * Subsequent calls reuse the same instance/promise.
 */
export function getC2pa(): Promise<C2paSdk> {
  if (!c2paInstance) {
    c2paInstance = createC2pa({ wasmSrc });
  }
  return c2paInstance;
}