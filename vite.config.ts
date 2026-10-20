import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative base so the build works on GitHub Pages at /takes-2911/.
export default defineConfig({
  base: './',
  plugins: [react()],
})
