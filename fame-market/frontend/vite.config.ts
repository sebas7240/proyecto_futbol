import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'firebase',
              test: /node_modules[\\/](@firebase|firebase)[\\/]/,
              priority: 30
            },
            {
              name: 'charts',
              test: /node_modules[\\/]lightweight-charts[\\/]/,
              priority: 20
            },
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|@tanstack)[\\/]/,
              priority: 10
            }
          ]
        }
      }
    }
  }
});
