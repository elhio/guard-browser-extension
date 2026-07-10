import { defineConfig } from 'wxt';
import fs from 'node:fs';
import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import svgr from 'vite-plugin-svgr';

export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-react', '@wxt-dev/auto-icons'],
  autoIcons: {
    baseIconPath: 'assets/guard.svg',
    developmentIndicator: false
  },
  zip: {
    excludeSources: ['node_modules', '.git', 'dist', '.wxt'],
    name: 'guard-browser-extension',
  },
  vite: () => ({
    build: {
      minify: 'esbuild',
      target: 'esnext',
    },
    plugins: [
      tailwindcss(),
      svgr(),
      {
        name: 'copy-onnx-wasm-files',
        buildStart() {
          const srcDir = path.resolve(process.cwd(), 'node_modules/onnxruntime-web/dist');
          const destDir = path.resolve(process.cwd(), 'public/wasm');

          if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
          }

          const filesToCopy = [
            'ort-wasm-simd-threaded.asyncify.wasm',
            'ort-wasm-simd-threaded.asyncify.mjs'
          ];

          for (const file of filesToCopy) {
            const srcPath = path.join(srcDir, file);
            const destPath = path.join(destDir, file);

            if (fs.existsSync(srcPath)) {
              fs.copyFileSync(srcPath, destPath);
            }
          }
        }
      }
    ],
  }),
  manifest: ({ browser }) => ({
    name: 'Guard',
    description: 'A browser extension to detect deepfakes and any other visual content you choose to filter out, right on the webpage',
    default_locale: 'en',
    homepage_url: 'https://elhio.com',
    browser_specific_settings: {
      gecko: { id: 'hello@elhio.com', strict_min_version: '109.0' },
    },
    minimum_chrome_version: '109',
    options_ui: { page: 'index.html', open_in_tab: true },
    // Chrome needs the offscreen permission for chrome.offscreen; Firefox uses a hidden iframe instead.
    permissions: [
      'storage',
      'unlimitedStorage',
      ...(browser === 'chrome' ? ['offscreen'] : []),
    ],
    // The C2PA SDK / ONNX runtime spawn a Web Worker from a `blob:` URL. Chrome treats a
    // same-origin blob: worker as `'self'` and allows it, but Firefox requires `blob:` to be
    // listed explicitly. Chrome MV3 rejects `blob:` in an extension_pages script-src, so the
    // looser policy is scoped to Firefox only.
    content_security_policy: {
      extension_pages:
        browser === 'firefox'
          ? "script-src 'self' 'wasm-unsafe-eval' blob:; worker-src 'self' blob:; object-src 'self';"
          : "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
    host_permissions: ['<all_urls>', `${process.env.VITE_API_URL}/*`],
    web_accessible_resources: [
      {
        resources: ['wasm/*.wasm', 'wasm/*.mjs', 'models/*', 'models/lens_light_v1/onnx/*'],
        matches: ['<all_urls>'],
      },
    ],
  })
});
