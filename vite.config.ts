import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' && process.env.REPL_ID !== undefined
      ? [
          import('@replit/vite-plugin-cartographer').then((m) => m.cartographer()),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'client', 'src'),
      '@shared': path.resolve(__dirname, 'shared'),
      '@assets': path.resolve(__dirname, 'attached_assets'),
    },
  },
  root: path.resolve(__dirname, 'client'),
  build: {
    outDir: path.resolve(__dirname, 'server/public'),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ['**/.*'], // Deny access to dotfiles (e.g., .env, .git)
    },
    host: '0.0.0.0', // Allow network access (matches npm start log)
    port: 8000, // Match port from Vite preview log
    allowedHosts: true, // Allow all hosts (fixes TypeScript error)
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // Proxy API calls to backend
        changeOrigin: true, // Adjust Host header for backend
      },
    },
  },
});