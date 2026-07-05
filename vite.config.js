import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'https://cazeexchange.pages.dev',
        changeOrigin: true,
        secure: true,
        ws: true,
        cookieDomainRewrite: "",
        headers: {
          // Ensure host header is rewritten to target
          host: 'cazeexchange.pages.dev'
        }
      }
    }
  }
});
