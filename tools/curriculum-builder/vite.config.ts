import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Автономное приложение: собирается независимо от корневого репозитория.
export default defineConfig({
  plugins: [react()],
});
