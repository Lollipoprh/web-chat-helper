// browser-tools 包
// 职责：浏览器自动化工具集合
// 阶段 5 已实现：
//   - get_active_tab：确认目标标签页及 URL
//   - get_page_snapshot：标题、URL、可见文本、可交互元素摘要（限制大小，过滤敏感字段）
//   - find_elements：文本/标签/角色/标签文字/选择器查找，多匹配不盲选
//   - click_element / fill_input / scroll_page：执行前重新定位，执行后返回证据
//   - wait_for_element / verify_action：等待页面更新并读取执行后的状态
// 运行架构：Service Worker 负责标签页与 Content Script 注入，Content Script 负责 DOM 操作
//          不持久化 DOM 节点引用，不执行任意 JavaScript

export * from './types'
export * from './tools'
