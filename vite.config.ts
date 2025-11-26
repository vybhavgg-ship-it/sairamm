import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, (process as any).cwd(), '');
  return {
    plugins: [react()],
    define: {
      // This ensures process.env.API_KEY in your code gets replaced with the actual value during build
      'process.env.API_KEY': JSON.stringify(env.API_KEY),
      'process.env': {} 
    },
  };
});