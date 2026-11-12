import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const publicOrigin = new URL(process.env.PUBLIC_SITE_URL || 'https://openpath-ai-demo-03531.vercel.app').origin
if (!publicOrigin.startsWith('https://')) throw new Error('PUBLIC_SITE_URL must use HTTPS')

export default defineConfig({
  base: '/',
  plugins: [react(), { name: 'path4u-public-metadata', transformIndexHtml: { order: 'pre', handler: html => html.replaceAll('__PATH4U_PUBLIC_ORIGIN__', publicOrigin) } }],
})
