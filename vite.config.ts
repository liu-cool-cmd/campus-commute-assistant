import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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
