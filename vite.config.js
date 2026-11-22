import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    // Increase warning limit (jsPDF is legitimately large, expected)
    chunkSizeWarningLimit: 500,
    // Use Rollup's native tree-shaking + minification
    minify: 'esbuild',
    target: 'es2020',
    rollupOptions: {
      output: {
        // Manual chunks: split heavy PDF libs from app code so they load on-demand
        manualChunks(id) {
          if (id.includes('jspdf') || id.includes('jsPDF')) return 'pdf-engine';
          if (id.includes('html2canvas')) return 'pdf-engine';
          if (id.includes('dompurify') || id.includes('purify')) return 'pdf-engine';
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'react-vendor';
          if (id.includes('firebase')) return 'firebase-vendor';
        },
        // Use content hashes for long-term caching
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  // Optimize dependency pre-bundling: exclude PDF libs from eager pre-bundle
  // since they are dynamically imported inside downloadPdf()
  optimizeDeps: {
    exclude: ['jspdf', 'html2canvas'],
  },
});
