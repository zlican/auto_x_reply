const STORAGE_KEYS = {
  provider: "modelProvider",
  apiKey: "providerApiKey",
  baseUrl: "providerBaseUrl",
  model: "providerModel",
  bloggerName: "bloggerName"
};

const PROVIDERS = {
  OPENAI_COMPATIBLE: "openai_compatible",
  GEMINI: "gemini"
};

const DEFAULTS = {
  provider: PROVIDERS.OPENAI_COMPATIBLE,
  baseUrl: "https://deeprouter.top/v1",
  model: "gpt-5.4",
  geminiBaseUrl: "https://generativelanguage.googleapis.com",
  geminiModel: "gemini-2.5-flash"
};

const elements = {
  provider: document.getElementById("provider"),
  apiKey: document.getElementById("apiKey"),
  apiKeyLabel: document.getElementById("apiKeyLabel"),
  baseUrl: document.getElementById("baseUrl"),
  model: document.getElementById("model"),
  modelLabel: document.getElementById("modelLabel"),
  bloggerName: document.getElementById("bloggerName"),
  sourceText: document.getElementById("sourceText"),
  resultText: document.getElementById("resultText"),
  status: document.getElementById("status"),
  generateBtn: document.getElementById("generateBtn"),
  copyBtn: document.getElementById("copyBtn")
};

init();

async function init() {
  const stored = await chrome.storage.local.get(Object.values(STORAGE_KEYS));
  elements.provider.value = stored[STORAGE_KEYS.provider] || DEFAULTS.provider;
  elements.apiKey.value = stored[STORAGE_KEYS.apiKey] || "";
  elements.baseUrl.value = stored[STORAGE_KEYS.baseUrl] || DEFAULTS.baseUrl;
  elements.model.value = stored[STORAGE_KEYS.model] || DEFAULTS.model;
  elements.bloggerName.value = stored[STORAGE_KEYS.bloggerName] || "";

  elements.provider.addEventListener("change", handleProviderChange);
  elements.apiKey.addEventListener("input", persistSettings);
  elements.baseUrl.addEventListener("input", persistSettings);
  elements.model.addEventListener("input", persistSettings);
  elements.bloggerName.addEventListener("input", persistSettings);
  elements.generateBtn.addEventListener("click", handleGenerate);
  elements.copyBtn.addEventListener("click", handleCopy);

  syncProviderUI(elements.provider.value);
}

async function persistSettings() {
  await chrome.storage.local.set({
    [STORAGE_KEYS.provider]: elements.provider.value,
    [STORAGE_KEYS.apiKey]: elements.apiKey.value.trim(),
    [STORAGE_KEYS.baseUrl]: elements.baseUrl.value.trim() || getDefaultBaseUrl(elements.provider.value),
    [STORAGE_KEYS.model]: elements.model.value.trim() || getDefaultModel(elements.provider.value),
    [STORAGE_KEYS.bloggerName]: elements.bloggerName.value.trim()
  });
}

function handleProviderChange() {
  syncProviderUI(elements.provider.value);
  persistSettings();
}

function syncProviderUI(provider) {
  if (provider === PROVIDERS.GEMINI) {
    elements.apiKeyLabel.textContent = "Gemini API Key";
    elements.modelLabel.textContent = "Gemini 模型";
    elements.apiKey.placeholder = "AIza...";

    if (!elements.baseUrl.value || elements.baseUrl.value === DEFAULTS.baseUrl) {
      elements.baseUrl.value = DEFAULTS.geminiBaseUrl;
    }

    if (!elements.model.value || elements.model.value === DEFAULTS.model) {
      elements.model.value = DEFAULTS.geminiModel;
    }

    return;
  }

  elements.apiKeyLabel.textContent = "OpenAI 兼容 API Key";
  elements.modelLabel.textContent = "模型";
  elements.apiKey.placeholder = "sk-...";

  if (!elements.baseUrl.value || elements.baseUrl.value === DEFAULTS.geminiBaseUrl) {
    elements.baseUrl.value = DEFAULTS.baseUrl;
  }

  if (!elements.model.value || elements.model.value === DEFAULTS.geminiModel) {
    elements.model.value = DEFAULTS.model;
  }
}

function getDefaultBaseUrl(provider) {
  return provider === PROVIDERS.GEMINI ? DEFAULTS.geminiBaseUrl : DEFAULTS.baseUrl;
}

function getDefaultModel(provider) {
  return provider === PROVIDERS.GEMINI ? DEFAULTS.geminiModel : DEFAULTS.model;
}

async function handleGenerate() {
  const provider = elements.provider.value;
  const apiKey = elements.apiKey.value.trim();
  const baseUrl = elements.baseUrl.value.trim() || getDefaultBaseUrl(provider);
  const model = elements.model.value.trim() || getDefaultModel(provider);
  const bloggerName = elements.bloggerName.value.trim();
  const sourceText = elements.sourceText.value.trim();

  if (!apiKey) {
    setStatus("请先填入 API Key。", "error");
    return;
  }

  if (!sourceText) {
    setStatus("请先粘贴原文内容。", "error");
    return;
  }

  if (!baseUrl) {
    setStatus("请先填入 Base URL。", "error");
    return;
  }

  elements.generateBtn.disabled = true;
  elements.copyBtn.disabled = true;
  setStatus("正在生成回复...", "");
  elements.resultText.value = "";

  try {
    await persistSettings();

    const prompt = buildPrompt({ bloggerName, sourceText });
    const result = await generateStableReply({
      provider,
      apiKey,
      baseUrl,
      model,
      prompt,
      sourceText,
      bloggerName
    });

    elements.resultText.value = result;
    elements.copyBtn.disabled = false;
    setStatus("生成完成，可以直接复制。", "success");
  } catch (error) {
    setStatus(error.message || "生成失败，请检查配置。", "error");
  } finally {
    elements.generateBtn.disabled = false;
  }
}

async function handleCopy() {
  const text = elements.resultText.value.trim();
  if (!text) {
    return;
  }

  await navigator.clipboard.writeText(text);
  setStatus("已复制到剪贴板。", "success");
}

function buildPrompt({ bloggerName, sourceText }) {
  const bloggerBlock = bloggerName
    ? `博主名：${bloggerName}\n如果名字自然，回复里可以只提一次。`
    : "博主名：未提供，不要强行编造名字。";

  return `你是一个中文社交媒体高回复率评论文案助手，目标是写出“博主很容易顺手回复”的一句评论。

任务：
基于我给出的原文，生成 1 条中文回复。
默认必须写成简单提问句。
重点不是总结内容，而是围绕原文里的一个具体点发起低门槛追问。

核心要求：
1. 必须紧扣原文里的具体信息、细节、观点或动作。
2. 必须优先写成是非型小问题，优先用“是不是”“能不能”“会不会”“更像是”“这个可以直接”。
3. 优先把大问题缩成小判断，不要把开放题原样抛给博主。
4. 最好让博主一句话就能回。
5. 回复要短，优先 12 到 24 个中文字符，最多 30 个中文字符。
6. 语气自然、像真人，稍微口语化，不要过度吹捧。
7. 不要输出多个版本，不要解释，不要加引号，不要加序号。
8. 不要使用 emoji、标签、英文营销词。

强制避免：
- 不要写总结式评论
- 不要写“学到了”“干货很多”“mark了”“期待更新”
- 不要问“怎么看”“如何做”“哪些能力”“建议是什么”这种开放式大题
- 不要连问两个问题
- 不要让博主重新写一篇长回答

风格参考：
示例 1
原文：麻吉大哥浮盈超过 150 万，30 天营收接近 100 万，还给了电报播报开平仓和直播地址。
回复：小牛哥，这个直播地址跟单能直接复制麻吉仓位吗

示例 2
原文：作者说 CME 缺口 67K 必然会回补，历史上回补率很高。
回复：rounder哥，是不是这种缺口往往是新的机会呀

示例 3
原文：纯银老师提到新人要长期积累几种核心能力。
错误回复：纯银老师认为新人需定向积累哪些能力
更好回复：纯银老师，新人是不是得先具备复盘能力

输出前自检：
- 有没有引用原文细节？
- 是不是一个小问题而不是大问题？
- 博主能不能一句话回复？

${bloggerBlock}

原文：
${sourceText}`;
}

async function generateStableReply({ provider, apiKey, baseUrl, model, prompt, sourceText, bloggerName }) {
  const firstPass = await callModel({ provider, apiKey, baseUrl, model, prompt });
  const firstText = cleanupOutput(firstPass.text);

  if (isUsableReply(firstText, firstPass.finishReason) && !needsNarrowing(firstText)) {
    return firstText;
  }

  const retryPrompt = buildRetryPrompt({
    sourceText,
    bloggerName,
    previousReply: firstText,
    finishReason: firstPass.finishReason,
    needsRewrite: needsNarrowing(firstText)
  });
  const secondPass = await callModel({ provider, apiKey, baseUrl, model, prompt: retryPrompt });
  const secondText = cleanupOutput(secondPass.text);

  if (isUsableReply(secondText, secondPass.finishReason)) {
    return secondText;
  }

  if (isFallbackReply(secondText)) {
    return secondText;
  }

  if (isFallbackReply(firstText)) {
    return firstText;
  }

  throw new Error("模型没有返回可用评论，请检查模型或重试。");
}

async function callModel({ provider, apiKey, baseUrl, model, prompt }) {
  if (provider === PROVIDERS.GEMINI) {
    return callGemini({ apiKey, model, prompt });
  }

  return callOpenAICompatible({ apiKey, baseUrl, model, prompt });
}

async function callGemini({ apiKey, model, prompt }) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.4,
          topP: 0.9,
          maxOutputTokens: 256,
          responseMimeType: "text/plain"
        }
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "Gemini 请求失败。");
  }

  const candidate = data?.candidates?.find((item) => {
    const text = item?.content?.parts?.map((part) => part.text || "").join("").trim();
    return Boolean(text);
  });
  const text = candidate?.content?.parts?.map((part) => part.text || "").join("").trim();

  if (!text) {
    throw new Error("模型没有返回可用内容。");
  }

  return {
    text,
    finishReason: candidate?.finishReason || ""
  };
}

async function callOpenAICompatible({ apiKey, baseUrl, model, prompt }) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  const response = await fetch(`${normalizedBaseUrl}/responses`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      store: false,
      input: prompt,
      text: {
        format: {
          type: "text"
        }
      }
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "OpenAI 兼容接口请求失败。");
  }

  const text = extractOpenAIText(data);

  if (!text) {
    throw new Error("模型没有返回可用内容。");
  }

  return {
    text,
    finishReason: data?.status === "incomplete" ? "INCOMPLETE" : data?.incomplete_details?.reason || ""
  };
}

function buildRetryPrompt({ sourceText, bloggerName, previousReply, finishReason, needsRewrite }) {
  const bloggerBlock = bloggerName
    ? `博主名：${bloggerName}\n如果自然可以提一次，不自然就不要硬提。`
    : "博主名：未提供，不要编造。";

  const issueLine = needsRewrite
    ? "你刚才输出的是开放式大问题，现在请把它改写成更容易回复的小判断问题。"
    : "你刚才输出不够完整，现在请重新生成一条完整评论。";

  return `${issueLine}

要求：
1. 只能输出 1 句完整中文评论。
2. 必须围绕原文细节。
3. 必须是小问题，不要是大问题。
4. 优先写成“是不是…/会不会…/更像是…”这种低门槛问法。
5. 长度控制在 12 到 30 个中文字符。
6. 不要解释，不要分点，不要引号。
7. 不要再输出“哪些能力”“怎么看”“如何做”“建议是什么”。

上次输出：
${previousReply || "空"}

结束原因：
${finishReason || "未知"}

${bloggerBlock}

原文：
${sourceText}`;
}

function cleanupOutput(text) {
  return text
    .replace(/^```[\w-]*\s*/g, "")
    .replace(/```$/g, "")
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/^\s*回复[:：]?\s*/i, "")
    .replace(/^\s*\d+[.)、]\s*/g, "")
    .replace(/\n+/g, " ")
    .trim();
}

function isUsableReply(text, finishReason) {
  if (!text) {
    return false;
  }

  if (finishReason === "MAX_TOKENS" || finishReason === "INCOMPLETE") {
    return false;
  }

  if (text.length < 5) {
    return false;
  }

  if (/[，,：:]$/.test(text)) {
    return false;
  }

  if (looksIncomplete(text)) {
    return false;
  }

  return true;
}

function looksIncomplete(text) {
  const trimmed = text.trim();

  if (/^[\u4e00-\u9fa5a-zA-Z0-9]{1,5}$/.test(trimmed)) {
    return true;
  }

  const fragments = ["我现在", "这个", "感觉", "所以", "然后", "就是"];
  if (trimmed.length <= 6 && fragments.includes(trimmed)) {
    return true;
  }

  return false;
}

function isFallbackReply(text) {
  if (!text) {
    return false;
  }

  if (text.length < 5) {
    return false;
  }

  if (/[，,：:]$/.test(text)) {
    return false;
  }

  return true;
}

function needsNarrowing(text) {
  const trimmed = text.trim();
  const broadPatterns = [
    /哪些/,
    /什么能力/,
    /怎么看/,
    /如何/,
    /建议/,
    /具体需要/,
    /应该怎么/,
    /需定向积累/
  ];

  if (broadPatterns.some((pattern) => pattern.test(trimmed))) {
    return true;
  }

  if (trimmed.length > 24 && !/[?？吗呢呀吧]$/.test(trimmed)) {
    return true;
  }

  return false;
}

function extractOpenAIText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const outputs = Array.isArray(data?.output) ? data.output : [];
  const texts = [];

  for (const item of outputs) {
    const contents = Array.isArray(item?.content) ? item.content : [];
    for (const content of contents) {
      if (typeof content?.text === "string" && content.text.trim()) {
        texts.push(content.text.trim());
      }
    }
  }

  return texts.join(" ").trim();
}

function setStatus(message, type) {
  elements.status.textContent = message;
  elements.status.className = type ? `status ${type}` : "status";
}
