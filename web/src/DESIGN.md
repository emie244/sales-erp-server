# Sales ERP - Design System

## 1. 视觉主题与氛围

- **基调**: 专业、高效、克制。工具感优先于装饰感。
- **密度**: 中高密度，适合数据密集型 ERP 场景。
- **哲学**: 界面应该消失，让用户专注于数据和操作。

## 2. 色彩体系

### 主色
| 角色 | 色值 | 用途 |
|:---|:---|:---|
| Primary | #2563EB | 主按钮、链接、激活状态、关键指标 |
| Success | #10B981 | 成功状态、正向数据、已审批 |
| Warning | #F59E0B | 警告、待处理、需要关注 |
| Error | #EF4444 | 错误、删除、拒绝、危险操作 |
| Info | #2563EB | 信息提示、次要操作 |

### 中性色
| 角色 | 色值 | 用途 |
|:---|:---|:---|
| Text Primary | #111111 | 标题、主文字 |
| Text Secondary | #6E6E6E | 次要文字、描述、标签 |
| Text Tertiary | #A0A0A0 | 占位符、禁用、提示 |
| Border | #EBEBEC | 分割线、边框、表格线 |
| Border Secondary | #F0F0F1 | 表头背景、hover 背景 |
| Background | #FFFFFF | 主背景 |
| Surface | #F7F7F8 | 卡片背景、侧栏、表头 |
| Surface Hover | #F0F0F1 | hover 状态背景 |

## 3. 排版

- **字体**: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
- **基础字号**: 14px
- **层级**:
  - H1: 24px / 600 / #111111
  - H2: 18px / 600 / #111111
  - H3: 16px / 500 / #111111
  - Body: 14px / 400 / #111111
  - Caption: 12px / 400 / #6E6E6E
  - Small: 11px / 500 / #A0A0A0 (大写，用于标签)

## 4. 组件样式

### 按钮
- **Primary**: bg #2563EB, text #FFFFFF, radius 6px, height 36px, padding 0 16px
- **Default**: bg #FFFFFF, border 1px #EBEBEC, text #111111, radius 6px
- **Danger**: bg #FFFFFF, border 1px #EF4444, text #EF4444, radius 6px
- **Text/Link**: bg transparent, text #2563EB, no border
- **Hover**: 背景色微调（Primary: #1D4ED8, Default: #F7F7F8）

### 卡片
- **背景**: #FFFFFF
- **边框**: 1px solid #EBEBEC
- **圆角**: 8px
- **阴影**: none（或用极淡的 0 1px 3px rgba(0,0,0,0.04)）
- **Padding**: 20px

### 输入框 / Select / DatePicker
- **背景**: #FFFFFF
- **边框**: 1px solid #EBEBEC
- **圆角**: 6px
- **Focus**: border-color #2563EB, box-shadow 0 0 0 2px rgba(37,99,235,0.1)
- **高度**: 36px

### 表格
- **表头**: bg #F7F7F8, text #6E6E6E, font-weight 500, font-size 12px
- **行**: bg #FFFFFF, border-bottom 1px solid #EBEBEC
- **行 Hover**: bg #F7F7F8
- **圆角**: 8px（外层容器）

### Tag
- **圆角**: 4px
- **字号**: 12px
- **Padding**: 2px 8px
- **风格**: 实色背景 + 对应文字色，无边框

### 模态框 / Drawer
- **背景**: #FFFFFF
- **圆角**: 12px
- **遮罩**: rgba(0,0,0,0.4)
- **阴影**: 0 20px 60px rgba(0,0,0,0.15)

## 5. 布局原则

- **间距系统**: 8px 基础单位（4, 8, 12, 16, 20, 24, 32, 48）
- **页面边距**: 24px
- **卡片间距**: 16px (gutter)
- **内容最大宽度**: 无限制，自适应
- **侧边栏**: 240px 宽, bg #F7F7F8, border-right 1px #EBEBEC

## 6. 深度与层级

- **层级 0**: 无阴影（大多数元素）
- **层级 1**: 0 1px 3px rgba(0,0,0,0.04)（卡片、下拉菜单）
- **层级 2**: 0 4px 12px rgba(0,0,0,0.08)（浮层面板）
- **层级 3**: 0 20px 60px rgba(0,0,0,0.15)（模态框）

## 7. 规范与禁忌

- **不要使用**: 渐变背景、大圆角（>12px）、强阴影、装饰性插图（工作区）
- **不要使用**: 粉色、紫色作为主色调
- **保持**: 边框细且颜色淡，hover 反馈微妙且一致
- **表格**:  always 使用细边框分隔行，不要使用斑马纹

## 8. 响应式

- **断点**: xs(<576), sm(>=576), md(>=768), lg(>=992), xl(>=1200)
- **侧边栏**: lg 以下可折叠为图标模式
- **表格**: 小屏幕水平滚动，不要折叠列

## 9. Agent Prompt Guide

当生成 UI 时：
- 使用 #FFFFFF 背景和 #F7F7F8 表面色
- 边框统一用 1px solid #EBEBEC
- 文字用 #111111 / #6E6E6E / #A0A0A0 三级体系
- 圆角：按钮 6px，卡片 8px，模态框 12px
- 按钮用实色，不要用渐变或玻璃态
- 表格表头用 12px 大写灰色标签风格
- 保持高信息密度，减少无意义的留白
