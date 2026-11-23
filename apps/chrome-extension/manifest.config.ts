import { defineManifest } from '@crxjs/vite-plugin'
import { version } from './package.json'

// Chrome 扩展 Manifest V3 定义
// 路径相对于 vite.config.ts 所在目录（apps/chrome-extension）
export default defineManifest({
  manifest_version: 3,
  // 产品名不翻译，保持品牌一致
  name: 'Web Chat Helper',
  // 描述与工具栏提示由 Chrome 在加载扩展时按浏览器语言从 public/_locales 解析，
  // 因此必须声明 default_locale；界面内文案另由 src/shared/i18n.ts 负责
  description: '__MSG_extDescription__',
  default_locale: 'zh_CN',
  // 版本号只在 package.json 维护，这里读同一份，避免两处手写走偏
  version,

  // 权限：sidePanel 侧边栏、storage 存储配置、tabs 标签页访问、scripting 注入脚本、activeTab 当前标签页
  // downloads：供 download_file 工具把模型产出的文本另存到系统下载目录（无需用户绑定文件）
  // contextMenus：右键「翻译当前页面」入口
  permissions: [
    'sidePanel',
    'storage',
    'tabs',
    'scripting',
    'activeTab',
    'downloads',
    'contextMenus',
  ],

  // 全站 https 访问权限：加载扩展即授予，任务中不再逐个站点弹窗授权。
  // 代价是 Chrome 会标注「可读取所有网站数据」；非本机 http 站点仍不在授权范围内。
  host_permissions: ['https://*/*'],

  // 可选主机权限：本机 http 地址不在必选权限内，仍在用户手势中按需申请
  // - http://localhost/* 等本机地址仅用于本地开发的兼容服务
  optional_host_permissions: ['http://localhost/*', 'http://127.0.0.1/*'],

  // Service Worker（后台脚本）
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },

  // 扩展图标：源图在 public/icons（由 1024 素材等比缩放生成）。
  // 16/32 用于工具栏与扩展列表，48 用于管理页，128 用于安装与商店。
  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
  },

  // 工具栏图标：点击后打开侧边栏（由 background 监听 chrome.action.onClicked）
  action: {
    default_title: '__MSG_actionTitle__',
    default_icon: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
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
