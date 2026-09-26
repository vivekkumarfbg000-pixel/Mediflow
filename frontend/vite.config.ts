import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

const daemonStarterPlugin = (): Plugin => ({
  name: 'jarvis-daemon-starter',
  configureServer(server: any) {
    server.middlewares.use('/api/start-daemon', (_req: any, res: any) => {
      try {
        const { exec } = require('child_process');
        // Force Windows to launch the daemon in a dedicated background shell
        exec('start /b node scripts/daemon-bridge.cjs', { cwd: __dirname });
        res.statusCode = 200;
        res.end(JSON.stringify({ status: 'ok', message: 'Daemon spawned' }));
      } catch (err: any) {
        res.statusCode = 500;
        res.end(JSON.stringify({ status: 'error', message: err.message }));
      }
    })
  }
})

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const plugins: any[] = [react()]

  if (mode === 'analyze') {
    plugins.push(visualizer({
      filename: 'bundle-analysis.html',
      open: true,
      gzipSize: true,
      brotliSize: true,
      template: 'treemap'
    }))
  }
  plugins.push(daemonStarterPlugin())

  return defineConfig({
    plugins,
    // ⚡ Pre-bundle heavy deps on dev-server start — instant first page load
    optimizeDeps: {
      include: [
        '@supabase/supabase-js',
        'react',
        'react-dom',
        'lucide-react'
      ]
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || ''),
      'import.meta.env.VITE_GEMINI_API_KEY': JSON.stringify(process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '')
    },
    server: {
      host: true,
      port: 5173,
      proxy: {
        '/api/gemini': {
          target: 'https://generativelanguage.googleapis.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/gemini/, '')
        }
      }
    },
    build: {
      // Modern esbuild target: smaller output, faster compilation
      target: 'es2020',
      // Skip gzip/brotli size reporting in CI — saves ~8-10s per Vercel build
      reportCompressedSize: false,
      chunkSizeWarningLimit: 600,
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('@supabase')) {
                return 'vendor-supabase';
              }
              if (id.includes('react-dom') || id.includes('react') || id.includes('scheduler')) {
                return 'vendor-react';
              }
              if (id.includes('lucide-react')) {
                return 'vendor-lucide';
              }
              // pdf-lib is ~500KB — keep isolated so it never blocks initial app load
              if (id.includes('pdf-lib') || id.includes('pdfmake')) {
                return 'vendor-pdf';
              }
              if (id.includes('date-fns') || id.includes('dayjs') || id.includes('moment')) {
                return 'vendor-date';
              }
              if (id.includes('zustand') || id.includes('jotai') || id.includes('recoil')) {
                return 'vendor-state';
              }
              return 'vendor';
            }
            if (id.includes('src/services')) {
              return 'core-services';
            }
          },
          chunkFileNames: 'assets/[name]-[hash].js',
          entryFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]'
        }
      }
    }
  })
})
