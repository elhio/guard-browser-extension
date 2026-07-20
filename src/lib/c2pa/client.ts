import { createC2pa, type C2paSdk } from '@contentauth/c2pa-web';
import wasmSrc from '@contentauth/c2pa-web/resources/c2pa.wasm?url';

let c2paInstance: Promise<C2paSdk> | undefined;

/**
 * Initializes and retrieves a singleton instance of the C2PA Web SDK
 *
 * @returns A promise that resolves to the fully initialized `C2paSdk` instance ready for manifest reading
 */
export function getC2pa(): Promise<C2paSdk> {
  if (!c2paInstance) {
    c2paInstance = createC2pa({ wasmSrc });
  }
  return c2paInstance;
}