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
  vite: () => ({
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
