import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react()],
    build: {
      target: 'esnext', // Crucial para soportar Top-Level Await usado por pdfjs-dist
    },
    define: {
      // Esto permite que 'process.env.API_KEY' funcione en el navegador
      // tomando el valor de la variable de entorno VITE_API_KEY o API_KEY
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY || env.API_KEY),
    },
  };
});