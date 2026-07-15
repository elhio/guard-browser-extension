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
    permissions: [
      'storage',
      'unlimitedStorage',
      ...(browser === 'chrome' ? ['offscreen'] : []),
      ...(browser === 'safari' ? ['nativeMessaging'] : []),
    ],
    content_security_policy: {
      extension_pages:
        browser === 'firefox' || browser === 'safari'
          ? "script-src 'self' 'wasm-unsafe-eval' blob:; worker-src 'self' blob:; object-src 'self';"
          : "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
    host_permissions: ['<all_urls>', `${process.env.VITE_API_URL}/*`],
  })
});
