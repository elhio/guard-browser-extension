import { defineConfig } from 'wxt';
import tailwindcss from '@tailwindcss/vite';
import svgr from 'vite-plugin-svgr';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react', '@wxt-dev/auto-icons'],
  autoIcons: {
    baseIconPath: 'assets/guard.svg',
    developmentIndicator: false
  },
  vite: () => ({
    plugins: [
      tailwindcss(),
      svgr()
    ],
  }),
  manifest: {
    name: 'Guard',
    version: '0.0.1',
    default_locale: "en",
    options_ui: {
      page: "index.html",
      open_in_tab: true
    },
    // offscreen: For C2PA WASM processing
    permissions: ['offscreen', 'storage', 'unlimitedStorage'],
    // allows the C2PA SDK to compile WASM in the offscreen document
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
    host_permissions: [
      '<all_urls>',
      `${process.env.VITE_API_URL}/*`
    ],
    web_accessible_resources: [
      {
        resources: ['wasm/*.wasm', 'wasm/*.mjs'],
        matches: ['<all_urls>']
      }
    ]
  }
});
