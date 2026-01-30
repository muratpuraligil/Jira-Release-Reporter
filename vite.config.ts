import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/Jira-Release-Reporter/', // 🔴 repo adı BİREBİR
})
