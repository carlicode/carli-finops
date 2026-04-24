import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      './runtimeConfig': './runtimeConfig.browser',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'aws-amplify': ['aws-amplify'],
          'recharts': ['recharts'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
