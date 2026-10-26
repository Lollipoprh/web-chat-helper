import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.config'

// Vite + CRXJS 扩展构建配置
// 输出目录为 dist，可直接 chrome://extensions "加载已解压的扩展程序"
export default defineConfig({
  plugins: [react(), crx({ manifest })],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // 生产构建不生成 sourcemap，避免暴露源码路径；需要调试时用 pnpm dev
    sourcemap: false,
    // 把脚本内联，便于 load-unpacked 时的 Content Script 动态 chunk 加载
    // （crx 默认已内联，这里显式声明以锁定行为）
    target: 'es2022',
  },
  server: {
    port: 5173,
    strictPort: true,
  },
})
