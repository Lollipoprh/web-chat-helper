// UI 组件层：所有界面元素从这里引入。
//
// 统一约定（新增组件必须遵守）：
// 1. 组件自带默认样式，默认值只来自 ./tokens，不写死色值和尺寸。
// 2. 通用参数名固定：size（xs/sm/md）、block、invalid、loading、style、className。
// 3. 调用方传入的 style 在默认样式之后合并，同名属性一定会覆盖默认值。
// 4. 其余原生属性（onClick、id、aria-*、title…）原样透传。
// 5. 本目录只做展示，不依赖 chrome.*，不得被 background / content 引用。
// 6. 颜色一律引用 ./tokens（内部是 ./theme.css 的 CSS 变量），因此自动支持深色模式；
//    伪类（:hover / :focus-visible）与动画写在 theme.css 里，内联样式写不了。

export * from './tokens'
export * from './style'
export * from './Button'
export * from './IconButton'
export * from './Icon'
export * from './Input'
export * from './Select'
export * from './Checkbox'
export * from './Field'
export * from './Alert'
export * from './Card'
export * from './Badge'
export * from './Tooltip'
export * from './Spinner'
export * from './Skeleton'
export * from './EmptyState'
export * from './Dialog'
export * from './Menu'
export * from './Segmented'
export * from './Chip'
export * from './Markdown'
export * from './markdown-parse'
