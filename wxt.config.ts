import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    // Chrome MV3 background is a service worker, which can't spawn Workers itself;
    // the C2PA SDK needs one, so we run it in an offscreen document instead.
    permissions: ['offscreen', 'storage', 'activeTab'],
    // The C2PA SDK compiles a WASM module; MV3's default script-src 'self' CSP
    // blocks that unless 'wasm-unsafe-eval' is explicitly allowed.
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
  },
});
