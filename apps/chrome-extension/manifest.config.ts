import { defineManifest } from '@crxjs/vite-plugin'

// Chrome 扩展 Manifest V3 定义
// 路径相对于 vite.config.ts 所在目录（apps/chrome-extension）
export default defineManifest({
  manifest_version: 3,
  name: 'Web Chat Helper',
  description: '基于 OpenAI 兼容 API 的浏览器 AI 助手，可读取和操作当前网页',
  version: '0.1.0',

  // 权限：sidePanel 侧边栏、storage 存储配置、tabs 标签页访问、scripting 注入脚本、activeTab 当前标签页
  permissions: ['sidePanel', 'storage', 'tabs', 'scripting', 'activeTab'],

  // 可选主机权限：安装时一律不授予，只在用户主动操作时按站点申请
  // - https://*/*        模型供应商与普通网页
  // - http://localhost/* 等本机地址仅用于本地开发的兼容服务
  optional_host_permissions: ['https://*/*', 'http://localhost/*', 'http://127.0.0.1/*'],

  // Service Worker（后台脚本）
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },

  // 工具栏图标：点击后打开侧边栏（由 background 监听 chrome.action.onClicked）
  action: {
    default_title: 'Web Chat Helper',
  },

  // 侧边栏入口（Chrome 114+）
  side_panel: {
    default_path: 'src/sidepanel/index.html',
  },

  // 设置页入口（从侧边栏链接跳转）
  options_ui: {
    page: 'src/options/index.html',
    open_in_tab: true,
  },

  // Content Script：这里声明只为让构建工具产出注入文件。
  // matches 使用永不匹配的占位域名，安装时不会获得任何站点访问权；
  // 真正的注入由 Service Worker 在用户授权当前站点后按需执行。
  content_scripts: [
    {
      matches: ['https://web-chat-helper.invalid/*'],
      js: ['src/content/index.ts'],
      run_at: 'document_idle',
    },
  ],

  // 构建工具会为 Content Script 生成 loader + chunk，二者通过 chrome-extension://
  // URL 动态加载；只有声明为 web accessible，授权站点的页面上下文才能加载这些代码。
  // 这里暴露的只是扩展自身的脚本产物，不含密钥或配置。
  web_accessible_resources: [
    {
      matches: ['https://*/*', 'http://localhost/*', 'http://127.0.0.1/*'],
      resources: ['assets/*'],
    },
  ],
})
