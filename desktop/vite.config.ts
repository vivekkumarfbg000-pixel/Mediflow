import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Prevent Vite from obscuring Tauri Rust logs
  clearScreen: false,
  // Tauri expects a fixed port
  server: {
    port: 1420,
    strictPort: true,
  },
  // Configure environment variables starting with TAURI_
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    // Tauri supports modern webviews
    target: process.env.TAURI_PLATFORM == 'windows' ? 'chrome105' : 'safari13',
    // Don't minify in debug builds
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    // Produce sourcemaps in debug
    sourcemap: !!process.env.TAURI_DEBUG,
  },
});
