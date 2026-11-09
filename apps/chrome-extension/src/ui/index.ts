// UI 组件层：所有界面元素从这里引入。
//
// 统一约定（新增组件必须遵守）：
// 1. 组件自带默认样式，默认值只来自 ./tokens，不写死色值和尺寸。
// 2. 通用参数名固定：size（xs/sm/md）、block、invalid、loading、style、className。
// 3. 调用方传入的 style 在默认样式之后合并，同名属性一定会覆盖默认值。
// 4. 其余原生属性（onClick、id、aria-*、title…）原样透传。
// 5. 本目录只做展示，不依赖 chrome.*，不得被 background / content 引用。

export * from './tokens'
export * from './style'
export * from './Button'
export * from './Input'
export * from './Select'
export * from './Checkbox'
export * from './Field'
export * from './Alert'
export * from './Card'
export * from './Badge'
