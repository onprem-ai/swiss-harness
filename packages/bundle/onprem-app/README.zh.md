---
description: "本地部署层：以你自己的模型端点运行 Web UI，关闭供应商遥测、账户与托管搜索，并以 Swiss Harness 的品牌呈现。"
kind: "package-bundle"
---

# @onprem-ai/dsh-onprem-app

[English](README.md) | 中文

## 概述

`dsh-onprem-app` 是 `onprem` profile 的第三个 patch 层，应用在 `dsh-base` 与 `dsh-web-app` 之后。它默认关闭所有会向上游供应商发送数据的配置行，把默认模型路由到你通过环境变量指定的 OpenAI 兼容端点，把插件安装固定到你选择的 registry，并把侧栏与首屏品牌替换为 Swiss Harness。用 `dsh onprem` 启动。边界：它决定默认值，而不是策略。运维人员可以在 profile 自己的 patch 层重新启用任何一行。

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

把 harness 指向你的模型服务器并启动 Web UI；无需其他配置。

### 启动本地部署 profile

```sh
export ONPREM_LLM_BASE_URL=http://vllm.internal:8000/v1
export ONPREM_LLM_MODEL=qwen3-32b
export ONPREM_LLM_API_KEY=…        # omit for an unauthenticated endpoint
dsh onprem
```

环境变量描述一条名为 `onprem` 的 provider 路由：

| 变量 | 默认值 | 含义 |
|---|---|---|
| `ONPREM_LLM_BASE_URL` | 未设置：无路由 | OpenAI 兼容服务器的端点根地址 |
| `ONPREM_LLM_MODEL` | `default` | 端点提供的模型 id；也是新会话的默认模型 |
| `ONPREM_LLM_API_KEY` | 未设置：占位请求头 | 每次请求通过凭据接缝读取；进入配置的是变量名，而不是它的值。未设置时，路由发送固定的 `Authorization: Bearer onprem-unauthenticated` 请求头，因为 OpenAI 兼容客户端没有它就拒绝发送；Ollama、vLLM 与 llama.cpp 会忽略它 |
| `ONPREM_LLM_API` | `openai-completions` | 协议：`openai-completions`、`openai-responses` 或 `anthropic-messages` |
| `ONPREM_LLM_CONTEXT` | `131072` | 上下文窗口（token 数） |
| `ONPREM_LLM_DISPLAY_NAME` | `On-premises model` | 模型选择器中显示的名称 |
| `DSH_PLUGIN_REGISTRY` | 未设置：pnpm 自身配置 | 插件管理器唯一会访问的 npm registry |
| `DSH_WEB_AUTH` | `launch-token` | `trusted-proxy` 去掉 `?token=` URL，并把到达监听器的每个请求都视为 owner；仅当经认证的反向代理是通往该端口的唯一网络路径时才设置 |

未设置 `ONPREM_LLM_BASE_URL` 时，profile 启动后没有任何模型路由，输入框显示 **Select model**，直到在模型设置页添加一条路由；该页面写入的正是本层预置的 `llm-pi-ai` 配置段。

### 哪些数据会离开本机

默认情况下，没有。下表列出上游中每一条会访问网络端点的配置行，以及本层对它的处理：

| 配置行 | 上游默认 | 本层 |
|---|---|---|
| `session-telemetry-otel` | 用户显式反馈后把会话前缀发送到供应商收集器 | 禁用 |
| `desktop-product-telemetry`、`product-analytics` | 桌面端使用分析 | 禁用 |
| `deepseek-account`、`account-controller`、`ui-settings-account`、`llm-deepseek-account` | 供应商账户登录 | 禁用 |
| `deepseek-llm-api-extensions`、`session-log-deepseek`、`plugin-package-inventory-deepseek` | 供应商特有的请求字段 | 禁用 |
| `llm-deepseek` | 直连供应商公开 API 的适配器 | 禁用 |
| `web-search-deepseek`、`web-deepseek-api` | 经供应商 API 的托管搜索与抓取 | 禁用；`web` 行只保留 `http` 抓取 provider |
| `message-feedback`、`ui-message-feedback`、`command-feedback` | 会触发遥测发送的反馈 | 禁用 |
| `plugin-manager` | 公共 registry 并带镜像回退 | 仅 `DSH_PLUGIN_REGISTRY`，无回退 |
| `web-fetch-http` | 上游 User-Agent | `swiss-harness/…` |

抓取工具保持开启，因为模型会抓取任务中出现的任何 URL；哪些主机可达属于部署的网络策略，而不是本层的职责。

### 重新启用某一行

上述每一行都是被禁用而非移除，因此 profile 自己的层可以把它重新打开。例如，要把会话遥测发送到内部收集器，在 `$DSH_HOME/profiles/onprem/cordis.patch.yml` 中添加：

```yaml
- id: session-telemetry-otel
  disabled: false
  config:
    mode: FEEDBACK_ONLY
    exporter:
      url: https://otel.internal/v1/logs
```

生成的[配置目录](../../../docs/config-catalog.zh.md)列出了每一行接受的全部字段。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部——点击展开</summary>

本包只是一个 patch 列表。`cordis.patch.yml` 由 profile 组合器在 base 与 web 层之后应用，因此每个 `- id:` 条目都指向这两层之一插入的行；目标不存在会产生 loader 警告，而本包的测试锁定：在 `dsh-base` 加 `dsh-web-app` 上组合不会产生任何警告。唯一的插入是品牌占位行。依赖部署环境的值是基于 `process.env` 的 `!!js` 表达式，在该行的 fiber 启动时求值，因此同一个构建可服务于每个站点。

### 源码地图

| 文件 | 作用 |
|---|---|
| [`cordis.patch.yml`](cordis.patch.yml) | 基于 base 与 web-app 的部署 patch |
| [`src/index.ts`](src/index.ts) | 空模块；manifest 的 `dsh.bundle.patch` 字段才是实质内容 |
| [`tests/onprem-app.spec.ts`](tests/onprem-app.spec.ts) | 无组合警告、每条外发行均禁用、路由与默认模型来自环境变量 |

### 不变量归属

未发布运行时不变量伴随组件，因为本组合包不注册任何内容，也不保留可变状态；被组合的各行所属的包拥有各自的不变量。

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

- [组合包地图](../README.zh.md)——基于同一核心构建的各个表层。
- [dsh-base](../base/README.zh.md) 与 [dsh-web-app](../web-app/README.zh.md)——本层所 patch 的两层。
- [dsh-llm-pi-ai](../../llm/llm-pi-ai/README.zh.md)——`onprem` 路由以及你新增的每条路由背后的适配器。
- [dsh-client-ui-brand-onprem](../../client/ui-brand-onprem/README.zh.md)——本层挂载的品牌占位包。
- [上游同步流程](../../../MERGING.md)——本层如何在新的上游版本中延续。

-----

<a id="model-experience"></a>
## 模型体验

间接地，通过它禁用的行与它预置的路由；每个被指向的行所属的包拥有面向模型的行为。

#### KV Cache 影响

本层自身没有；禁用供应商请求扩展行会移除这些行原本会附加到每个请求的 `dsh_session_log` 与包清单字段。

## 已知限制与延期工作

<a id="known-limitations-and-deferred-work"></a>

这些是本层当前的约束，而不是与上游默认值的比较。

- **仅 Web profile**——`onprem` 模板叠加在 `dsh-web-app` 之上；headless、SDK 与 ACP 部署在对应模板出现之前，需把本组合包加入各自的 profile manifest。
- **桌面端打包仍沿用上游名称**——Electron 产品名、安装程序文案与更新源不在本层范围内。
- **未挂载搜索 provider**——在运维人员挂载一个并在 `web` 行中命名之前，网页搜索调用会失败。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文——点击展开</summary>

本组合包是 onprem.ai 的覆盖层，不是上游代码。当上游版本新增会访问网络的行时，请在同一次变更中把它加入此处以及测试中的外发行列表。

</details>
