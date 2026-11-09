import { defineConfig } from 'vite';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  base: '/',
  plugins: [{ name: 'local-pdf-resources', generateBundle() {
    for (const directory of ['cmaps', 'standard_fonts', 'wasm']) {
      const root = new URL(`./node_modules/pdfjs-dist/${directory}/`, import.meta.url);
      for (const name of readdirSync(root).filter(name => !name.startsWith('quickjs'))) this.emitFile({ type: 'asset', fileName: `assets/pdf/${directory}/${name}`, source: readFileSync(new URL(name, root)) });
    }
    this.emitFile({ type: 'asset', fileName: 'assets/pdf/pdf.worker.min.mjs', source: readFileSync(fileURLToPath(new URL('./node_modules/pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url))) });
  } }],
  build: {
    outDir: '../src/aurora-dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/aurora.js',
        assetFileNames: asset => asset.names.some(name => name.endsWith('.css')) ? 'assets/aurora.css' : 'assets/[name]-[hash][extname]'
      }
    }
  }
});
