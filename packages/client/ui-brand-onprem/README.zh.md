---
description: "面向侧栏与会话首屏的 Swiss Harness 品牌填充，在所有客户端构建中生效；供选择或替换品牌呈现的维护者阅读。"
kind: "package-reference"
---

# @onprem-ai/dsh-client-ui-brand-onprem

[English](README.md) | 中文

## 概述

本包让 Web 客户端在侧栏显示 Swiss Harness 标志与名称，并在会话首屏显示同一标志。与上游官方品牌包不同，它在所有客户端构建中都会注册，因此部署的品牌身份不依赖构建期 profile。通过 `onprem` profile 选择它，该 profile 会用它替换官方占位。本包不保留运行时状态，也不影响模型请求。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

在以 Swiss Harness 品牌呈现的部署的浏览器名册中挂载本插件；`onprem-app` 组合包会这样做，并在同一层禁用上游的 `ui-brand-official` 行。

### 替换品牌

使用其他品牌身份时，不引入本包，而是组合一个占据同样三个 slot 的包：`sidebar.brand.mark`、`sidebar.brand.name` 与 `conversation.hero.brand.mark`。占据 slot 是唯一的组合途径；这里没有品牌配置界面。浏览器标题属于构建环境（`DSH_CLIENT_TITLE`），不在 slot 系统之内。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部——点击展开</summary>

侧栏占位作为一个感知声明的注册集合安装：嵌套的 `ctx.slots.inject()` 调用会等待侧栏声明，因此无论本行在声明者之前还是之后激活都能工作，并在声明消失时撤回两个占位。首屏占位是基于会话声明的第二个集合。标志是一个单色的瑞士国旗十字内联 SVG（1 单位圆角）：方块使用 brand-primary token，十字使用基础背景 token，因此浅色主题下为黑底白十字，深色主题下为白底黑十字，无需资源管线。浏览器一半位于 [`src/client/index.ts`](src/client/index.ts)；node 一半是一个空的 Loader 席位。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [ui-sidebar](../ui-sidebar/README.zh.md)——声明 `sidebar.brand.mark` 与 `sidebar.brand.name` 并渲染它们的回退。
- [ui-conversation](../ui-conversation/README.zh.md)——在首屏声明 `conversation.hero.brand.mark`。
- [ui-brand-official](../ui-brand-official/README.zh.md)——本包所替换的上游占位。
- [dsh-onprem-app](../../bundle/onprem-app/README.zh.md)——挂载本包的组合包。

-----

<a id="model-experience"></a>
## 模型体验

无，因为本包只提供浏览器呈现；这里没有任何内容会进入模型请求。

#### KV Cache 影响

无；本包既不组装也不发送 provider 请求。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

这些限制定义了品牌呈现的提供方式。它们是本包当前的约束，而不是品牌设计比较。

- **单一占位集合**——其他呈现方式应放在占据同样 slot 的另一个 Cordis 包中。
- **浏览器标题独立**——`DSH_CLIENT_TITLE` 在构建期选择标题文本，而不是通过 UI slot。
- **占位标志**——方框十字标志是在 onprem.ai 提供最终设计之前的临时方案；替换 `Brand.tsx` 中的 SVG 即可。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

本包是 onprem.ai 的覆盖层，不是上游代码。它镜像 `ui-brand-official`，因此上游对 slot 契约的改动会在两者中表现为同样的编译错误。

</details>

**运行时不变量：** 未发布伴随组件。本包不保留可变状态，其 slot 占位通过事务性 effect 安装与撤出。
