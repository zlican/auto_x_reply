# Hook Reply Generator

一个最小可用的 Chrome 插件。

用途：
把文章、推文、长帖内容粘贴进去，调用 AI 生成一句更贴合原文、带钩子、博主更容易顺手回复的评论。

## 已实现

- 手动粘贴原文内容
- 手动填写博主名
- 支持 `Gemini`
- 支持 `OpenAI 兼容接口`
- 一键生成回复
- 一键复制结果
- 自动保存提供商、Key、Base URL、模型名、博主名

## 文件说明

- `manifest.json`：Chrome 插件配置
- `popup.html`：插件弹窗页面
- `popup.css`：弹窗样式
- `popup.js`：请求逻辑、提示词、重写兜底
- `example.md`：你给的风格样例

## 使用方法

1. 打开 Chrome，进入 `chrome://extensions/`
2. 打开右上角“开发者模式”
3. 点击“加载已解压的扩展程序”
4. 选择当前目录：

```text
D:\trade-project\25.推文自动优质回复\code
```

5. 点击插件图标，填入：
   - `AI 提供商`
   - `API Key`
   - `Base URL`
   - `模型`
   - `博主名`，可选
   - `原文内容`
6. 点击“生成回复”
7. 点击“复制结果”

## 默认配置

我已经按你本机 `.codex/config.toml` 当前的配置做了默认值：

```text
提供商: OpenAI 兼容 / Codex 配置
Base URL: https://deeprouter.top/v1
模型: gpt-5.4
```

这意味着你现在本机 Codex 实际走的是一个 OpenAI 兼容网关，不是单独另一套浏览器可直接读取的本地模型。

## 接口说明

### 1. OpenAI 兼容

插件会调用：

```text
POST {BASE_URL}/responses
Authorization: Bearer {YOUR_API_KEY}
```

### 2. Gemini

插件会调用：

```text
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={YOUR_API_KEY}
```

## 说明

- 当前不会自动读取本机 `.codex/auth.json`，避免把本地密钥写进插件代码。
- 你只需要把自己的 API Key 粘进去即可。
- 生成后如果模型给出开放式大题，插件会自动做一次“小问题窄化重写”。
