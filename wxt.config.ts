import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    // Chrome MV3 background is a service worker, which can't spawn Workers itself;
    // the C2PA SDK needs one, so we run it in an offscreen document instead.
    permissions: ['offscreen'],
  },
});
