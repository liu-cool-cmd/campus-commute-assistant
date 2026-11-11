import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', '@capacitor/core', '@capacitor/preferences'],
          map: ['leaflet', 'react-leaflet'],
          calendar: ['ical.js', 'fflate'],
          icons: ['lucide-react'],
        },
      },
    },
  },
  server: {
    proxy: {
      '/api/duke-gtfs': {
        target: 'https://duke.transloc.com',
        changeOrigin: true,
        secure: true,
        rewrite: () => '/Secure/Admin/Reports/GTFSDownload.aspx',
      },
    },
  },
  test: {
    environment: 'node',
    coverage: { reporter: ['text', 'html'] },
  },
});
