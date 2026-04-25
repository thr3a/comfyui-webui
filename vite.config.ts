import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), vanillaExtractPlugin()],
  server: {
    proxy: {
      '/api': 'http://deep01.local:8188',
      '/ws': {
        target: 'ws://deep01.local:8188',
        ws: true
      }
    }
  }
});
