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
  const archetypeHints = buildArchetypeHints(sourceText);
  const intentHints = buildIntentHints(sourceText);
  const openingHints = buildOpeningHints(sourceText);
  const answerHints = buildAnswerHints(sourceText);
  const questionFrameHints = buildQuestionFrameHints(sourceText);

  return `你是一个中文社交媒体高回复率评论文案助手，目标是写出“博主很容易顺手回复”的一句评论。

任务：
基于我给出的原文，生成 1 条中文回复。
默认必须写成简单提问句。
重点不是总结内容，而是围绕原文里的一个具体点发起低门槛追问。
这次新增一个关键侧入点：先从原文反推博主这条内容最想收获什么反馈、最想听观众说什么，再顺着那个点发问。

核心要求：
1. 必须紧扣原文里的具体信息、细节、观点或动作。
2. 先判断博主更想被哪种评论接住，只选一个主方向：
   - 被认可判断准、看得早
   - 被追问入口、工具、资源、跟法
   - 被确认成果是否可复制
   - 被接住立场、情绪、经验者身份
   - 被问一个很小的执行判断
3. 最终回复必须顺着上面那个主方向，让博主感觉“这条评论正好问到我想接的话头”。
4. 必须写成低压力小问题，但不要默认总用“是不是”开头。
5. 问法要自然轮换，优先根据原文内容选择更贴切的形式，比如“这个能直接…吗”“这次更像…吗”“你这里主要是…吗”“这种情况会不会…”“这里算不算…”。
6. 只有原文本身明显在做判断、预测、站立场时，才可以偶尔用“是不是”。
7. 优先把大问题缩成小判断，不要把开放题原样抛给博主。
8. 最好让博主一句话就能回，回复压力越低越好。
9. 回复要短，优先 12 到 24 个中文字符，最多 30 个中文字符。
10. 语气自然、像真人，稍微口语化，不要过度吹捧。
11. 不要输出多个版本，不要解释，不要加引号，不要加序号。
12. 不要使用 emoji、标签、英文营销词。

内容识别时，不要只盯一种类型。优先在这些内容类型里选最强的 1 个：
${archetypeHints}

强制避免：
- 不要写总结式评论
- 不要写“学到了”“干货很多”“mark了”“期待更新”
- 不要问“怎么看”“如何做”“哪些能力”“建议是什么”这种开放式大题
- 不要连问两个问题
- 不要让博主重新写一篇长回答
- 不要写“方便展开讲讲吗”“能详细说说吗”“可以系统讲下吗”这种高压力问法
- 不要形成固定模板，不要动不动就用“是不是”起手

隐藏分析步骤：
1. 先看原文最显眼的是成果、判断、资源入口、方法、情绪立场，还是身份表达。
2. 再判断博主最希望评论区出现哪种声音。
3. 再判断最自然的问法开头，不要机械重复。
4. 最终只输出评论，不要暴露你的分析过程。

从文本推测博主诉求时，可参考这些线索：
${intentHints}

问法开头可参考这些线索：
${openingHints}

优先把问题收窄到博主能这样回答：
${answerHints}

可优先套用这些低压力问句骨架：
${questionFrameHints}

风格参考：
示例 1
原文：麻吉大哥浮盈超过 150 万，30 天营收接近 100 万，还给了电报播报开平仓和直播地址。
回复：小牛哥，这个直播地址跟单能直接复制麻吉仓位吗

示例 2
原文：作者说 CME 缺口 67K 必然会回补，历史上回补率很高。
回复：rounder哥，这里更像等回补再上吗

示例 3
原文：纯银老师提到新人要长期积累几种核心能力。
错误回复：纯银老师认为新人需定向积累哪些能力
更好回复：纯银老师，新人先抓复盘能力就行吗

输出前自检：
- 有没有引用原文细节？
- 是不是顺着博主最想被接住的点在发问？
- 是不是一个小问题而不是大问题？
- 有没有避免机械地用“是不是”起手？
- 博主是不是几秒钟就能回？
- 博主能不能一句话回复？

${bloggerBlock}

原文：
${sourceText}`;
}

async function generateStableReply({ provider, apiKey, baseUrl, model, prompt, sourceText, bloggerName }) {
  const firstPass = await callModel({ provider, apiKey, baseUrl, model, prompt });
  const firstText = cleanupOutput(firstPass.text);

  if (isUsableReply(firstText, firstPass.finishReason, sourceText) && !needsNarrowing(firstText, sourceText)) {
    return firstText;
  }

  const retryPrompt = buildRetryPrompt({
    sourceText,
    bloggerName,
    previousReply: firstText,
    finishReason: firstPass.finishReason,
    needsRewrite: needsNarrowing(firstText, sourceText)
  });
  const secondPass = await callModel({ provider, apiKey, baseUrl, model, prompt: retryPrompt });
  const secondText = cleanupOutput(secondPass.text);

  if (isUsableReply(secondText, secondPass.finishReason, sourceText)) {
    return secondText;
  }

  if (isFallbackReply(secondText, sourceText)) {
    return secondText;
  }

  if (isFallbackReply(firstText, sourceText)) {
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
  const archetypeHints = buildArchetypeHints(sourceText);
  const intentHints = buildIntentHints(sourceText);
  const openingHints = buildOpeningHints(sourceText);
  const answerHints = buildAnswerHints(sourceText);
  const questionFrameHints = buildQuestionFrameHints(sourceText);

  const issueLine = needsRewrite
    ? "你刚才输出的问题太大或回复压力太高，现在请改写成更容易顺手回复的小判断问题。"
    : "你刚才输出不够完整，现在请重新生成一条完整评论。";

  return `${issueLine}

要求：
1. 只能输出 1 句完整中文评论。
2. 必须围绕原文细节。
3. 先从原文反推博主最想收获哪种评论，再顺着那个点发问。
4. 必须是小问题，不要是大问题。
5. 不要默认再用“是不是”开头，优先改成更贴切的自然问法。
6. 只有原文明显在做判断、预测、站立场时，才可以偶尔用“是不是”。
7. 可参考这些开头：“这个能直接…吗 / 这次更像…吗 / 你这里主要是…吗 / 这种情况会不会… / 这里算不算…”。
8. 不要让博主需要展开长解释，不要出现“展开讲讲”“详细说说”“系统讲下”。
9. 长度控制在 12 到 30 个中文字符。
10. 不要解释，不要分点，不要引号。
11. 不要再输出“哪些能力”“怎么看”“如何做”“建议是什么”。

内容类型参考：
${archetypeHints}

上次输出：
${previousReply || "空"}

结束原因：
${finishReason || "未知"}

从文本推测博主诉求时，可参考这些线索：
${intentHints}

问法开头可参考这些线索：
${openingHints}

优先把问题收窄到博主能这样回答：
${answerHints}

可优先套用这些低压力问句骨架：
${questionFrameHints}

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

function isUsableReply(text, finishReason, sourceText) {
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

  if (isOverTemplatedReply(text, sourceText)) {
    return false;
  }

  if (!isQuestionLike(text)) {
    return false;
  }

  if (createsReplyPressure(text)) {
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

function isFallbackReply(text, sourceText) {
  if (!text) {
    return false;
  }

  if (text.length < 5) {
    return false;
  }

  if (/[，,：:]$/.test(text)) {
    return false;
  }

  if (createsReplyPressure(text)) {
    return false;
  }

  if (isOverTemplatedReply(text, sourceText)) {
    return false;
  }

  if (!isQuestionLike(text)) {
    return false;
  }

  return true;
}

function needsNarrowing(text, sourceText) {
  const trimmed = text.trim();
  const broadPatterns = [
    /哪些/,
    /什么能力/,
    /怎么看/,
    /如何/,
    /建议/,
    /具体需要/,
    /应该怎么/,
    /需定向积累/,
    /展开/,
    /详细说/,
    /细讲/,
    /系统讲/,
    /说说为什么/,
    /具体聊聊/
  ];

  if (broadPatterns.some((pattern) => pattern.test(trimmed))) {
    return true;
  }

  if (createsReplyPressure(trimmed)) {
    return true;
  }

  if (isOverTemplatedReply(trimmed, sourceText)) {
    return true;
  }

  if (trimmed.length > 24 && !/[?？吗呢呀吧]$/.test(trimmed)) {
    return true;
  }

  return false;
}

function buildIntentHints(sourceText) {
  const hints = [];
  const normalized = sourceText.replace(/\s+/g, " ");

  if (/(盈利|收益|浮盈|翻倍|营收|赚|回补率|胜率|收益率|[0-9]+\s*万|[0-9]+%)/.test(normalized)) {
    hints.push("- 如果原文在晒结果、战绩、数据，优先往“这说明你判断对了吧 / 这个现在还能复制吗”这类评论靠。");
  }

  if (/(直播|电报|tg|群|链接|地址|脚本|工具|api|vps|入口|教程|文档|下载)/i.test(normalized)) {
    hints.push("- 如果原文带入口、资源、工具、链接，优先问一个很小的使用门槛或获取方式，别让博主重新讲全套。");
  }

  if (/(策略|方法|思路|逻辑|框架|复盘|经验|步骤|Q&A|教程|打法)/i.test(normalized)) {
    hints.push("- 如果原文在讲方法论，优先把大方法缩成一个单点判断，让博主只需要确认对不对。");
  }

  if (/(上线|更新|版本|功能|产品|插件|网站|app|工具站|新功能|内测|发布)/i.test(normalized)) {
    hints.push("- 如果原文在发产品、版本、功能更新，优先问一个很小的使用门槛、适用人群或当前开放状态。");
  }

  if (/(看多|看空|必然|一定|会不会|应该|机会|风险|拐点|回补|见顶|补涨|判断)/.test(normalized)) {
    hints.push("- 如果原文在下判断或站立场，优先问“你的核心判断更像这个吗”而不是让他再写一大段论证。");
  }

  if (/(新人|小白|入门|建议|避坑|注意|提醒|先做|别急)/.test(normalized)) {
    hints.push("- 如果原文在塑造经验者身份，优先问一个“先抓这个就行吗 / 先避开这个对吗”的小问题。");
  }

  if (/(踩坑|翻车|崩了|后悔|教训|反思|复盘|亏麻|焦虑|难受|心态|崩溃|emo)/.test(normalized)) {
    hints.push("- 如果原文在讲踩坑、复盘、情绪波动，优先接住他的经验或情绪，再问一个很小的避坑判断。");
  }

  if (/(我觉得|本质|其实|不是.*而是|观点|立场|吐槽|问题在于|关键是)/.test(normalized)) {
    hints.push("- 如果原文在输出观点或吐槽，优先问“你最核心想表达的是不是这个点”，让他容易顺着立场继续一句。");
  }

  if (/(招募|报名|名额|合作|一起做|征集|招聘|内推|欢迎|私信|加我)/.test(normalized)) {
    hints.push("- 如果原文在招募、合作、征集，优先问一个资格门槛、参与方式或是否仍开放的小问题。");
  }

  if (/(故事|经历|第一次|刚刚|昨晚|今天|一路|一路走来|这几年|一路踩坑)/.test(normalized)) {
    hints.push("- 如果原文在讲个人经历或故事，优先问故事里最关键的转折点是不是某个小节点。");
  }

  if (!hints.length) {
    hints.push("- 默认优先抓原文里最想被认可、被追问、被确认能落地的那个点。");
  }

  return hints.slice(0, 5).join("\n");
}

function buildOpeningHints(sourceText) {
  const hints = [];
  const normalized = sourceText.replace(/\s+/g, " ");

  if (/(直播|电报|tg|群|链接|地址|脚本|工具|api|vps|入口|教程|文档|下载)/i.test(normalized)) {
    hints.push("- 有入口、链接、工具时，优先用“这个能直接…吗”“这个要先…吗”这类开头。");
  }

  if (/(盈利|收益|浮盈|翻倍|营收|赚|胜率|收益率|[0-9]+\s*万|[0-9]+%)/.test(normalized)) {
    hints.push("- 有结果、数据时，优先用“这次算…吗”“这个现在还能…吗”这类开头。");
  }

  if (/(策略|方法|思路|逻辑|框架|复盘|经验|步骤|Q&A|教程|打法)/i.test(normalized)) {
    hints.push("- 有方法、经验时，优先用“这里主要是…吗”“先抓…就行吗”这类开头。");
  }

  if (/(上线|更新|版本|功能|产品|插件|网站|app|新功能|内测|发布)/i.test(normalized)) {
    hints.push("- 有产品、功能、版本更新时，优先用“这个现在开放…吗”“这个主要给…用吗”这类开头。");
  }

  if (/(看多|看空|必然|一定|应该|机会|风险|拐点|回补|见顶|补涨|判断)/.test(normalized)) {
    hints.push("- 有判断、预测时，优先用“这次更像…吗”“这种情况会不会…”；只有这类文本才偶尔允许“是不是”。");
  }

  if (/(踩坑|翻车|崩了|后悔|教训|反思|亏麻|焦虑|心态|emo)/.test(normalized)) {
    hints.push("- 有踩坑、反思、情绪时，优先用“这次主要卡在…吗”“以后先避开…就行吗”这类开头。");
  }

  if (/(招募|报名|名额|合作|一起做|征集|招聘|内推|欢迎|私信|加我)/.test(normalized)) {
    hints.push("- 有招募、合作、征集时，优先用“现在还开放…吗”“这个主要看…吗”这类开头。");
  }

  if (/(我觉得|本质|其实|不是.*而是|观点|立场|吐槽|问题在于|关键是)/.test(normalized)) {
    hints.push("- 有观点表达时，优先用“你这里核心想说的是…吗”“你更想提醒大家…吗”这类开头。");
  }

  if (!hints.length) {
    hints.push("- 默认优先用“这个能…吗 / 这里更像…吗 / 你这里主要是…吗 / 这样算…吗”，避免机械重复。");
  }

  return hints.slice(0, 5).join("\n");
}

function buildArchetypeHints(sourceText) {
  const hints = [];
  const normalized = sourceText.replace(/\s+/g, " ");

  if (/(盈利|收益|浮盈|翻倍|营收|赚|胜率|收益率|[0-9]+\s*万|[0-9]+%)/.test(normalized)) {
    hints.push("- 晒结果/晒战绩：博主更想被确认判断准、时机好、结果是否可复制。");
  }

  if (/(看多|看空|必然|一定|应该|机会|风险|拐点|回补|见顶|补涨|判断|预期)/.test(normalized)) {
    hints.push("- 下判断/给预期：博主更想有人接住他的核心判断，而不是逼他重讲全套逻辑。");
  }

  if (/(链接|地址|入口|工具|脚本|电报|tg|群|api|vps|教程|文档|下载)/i.test(normalized)) {
    hints.push("- 发资源/给入口：博主更想被追问怎么进入、怎么用、门槛高不高。");
  }

  if (/(策略|方法|思路|逻辑|框架|步骤|复盘|经验|教程|打法|Q&A)/i.test(normalized)) {
    hints.push("- 教方法/讲经验：博主更想被问一个关键单点，而不是被要求展开系统课程。");
  }

  if (/(上线|更新|版本|功能|产品|插件|网站|app|新功能|内测|发布)/i.test(normalized)) {
    hints.push("- 发产品/功能更新：博主更想被问适合谁、现在能不能用、和旧版差在哪个小点。");
  }

  if (/(踩坑|翻车|崩了|后悔|教训|反思|亏麻|焦虑|心态|崩溃|emo)/.test(normalized)) {
    hints.push("- 复盘踩坑/情绪表达：博主更想被接住经验价值或情绪重点，而不是被追着解释所有背景。");
  }

  if (/(我觉得|本质|其实|不是.*而是|观点|立场|吐槽|问题在于|关键是)/.test(normalized)) {
    hints.push("- 输出观点/吐槽：博主更想别人准确理解他到底在反对或强调什么。");
  }

  if (/(故事|经历|第一次|刚刚|昨晚|今天|一路|一路走来|这几年)/.test(normalized)) {
    hints.push("- 讲故事/讲经历：博主更想别人抓到转折点、代价或决定性瞬间。");
  }

  if (/(招募|报名|名额|合作|一起做|征集|招聘|内推|欢迎|私信|加我)/.test(normalized)) {
    hints.push("- 招募/合作/征集：博主更想被问参与方式、门槛、还是否开放。");
  }

  if (!hints.length) {
    hints.push("- 默认按“观点 / 结果 / 方法 / 资源 / 情绪 / 产品”里最明显的那一类去理解。");
  }

  return hints.slice(0, 6).join("\n");
}

function buildAnswerHints(sourceText) {
  const hints = [];
  const normalized = sourceText.replace(/\s+/g, " ");

  hints.push("- 最好让博主只需回答：是 / 不是。");
  hints.push("- 或只需补一个名词、门槛、时间点、入口、对象、前置条件。");

  if (/(链接|地址|入口|工具|脚本|电报|tg|群|api|vps|教程|文档|下载)/i.test(normalized)) {
    hints.push("- 对资源型内容，优先让他回答“能不能直接用 / 需不需要先申请 / 去哪里进”。");
  }

  if (/(上线|更新|版本|功能|产品|插件|网站|app|新功能|内测|发布)/i.test(normalized)) {
    hints.push("- 对产品型内容，优先让他回答“现在开放吗 / 主要给谁用 / 核心变化是哪一个点”。");
  }

  if (/(招募|报名|名额|合作|一起做|征集|招聘|内推|欢迎|私信|加我)/.test(normalized)) {
    hints.push("- 对招募型内容，优先让他回答“还收吗 / 主要看什么条件 / 现在怎么报名”。");
  }

  if (/(踩坑|翻车|崩了|后悔|教训|反思|亏麻|焦虑|心态|emo)/.test(normalized)) {
    hints.push("- 对踩坑或反思型内容，优先让他回答“主要问题是不是这个 / 下次先避开什么”。");
  }

  if (/(我觉得|本质|其实|不是.*而是|观点|立场|吐槽|问题在于|关键是)/.test(normalized)) {
    hints.push("- 对观点型内容，优先让他回答“你真正想强调的是 A 不是 B，对吗”。");
  }

  return hints.slice(0, 5).join("\n");
}

function buildQuestionFrameHints(sourceText) {
  const hints = [];
  const normalized = sourceText.replace(/\s+/g, " ");

  hints.push("- 这个能直接___吗");
  hints.push("- 这里更像___吗");
  hints.push("- 你这里主要是___吗");

  if (/(盈利|收益|浮盈|翻倍|营收|赚|胜率|收益率|[0-9]+\s*万|[0-9]+%)/.test(normalized)) {
    hints.push("- 这个现在还算能复制吗");
  }

  if (/(策略|方法|思路|逻辑|框架|步骤|复盘|经验|教程|打法|Q&A)/i.test(normalized)) {
    hints.push("- 这里先抓___就行吗");
  }

  if (/(链接|地址|入口|工具|脚本|电报|tg|群|api|vps|教程|文档|下载)/i.test(normalized)) {
    hints.push("- 这个要先___才能进吗");
  }

  if (/(上线|更新|版本|功能|产品|插件|网站|app|新功能|内测|发布)/i.test(normalized)) {
    hints.push("- 这个现在主要给___用吗");
  }

  if (/(招募|报名|名额|合作|一起做|征集|招聘|内推|欢迎|私信|加我)/.test(normalized)) {
    hints.push("- 现在还开放___吗");
  }

  if (/(踩坑|翻车|崩了|后悔|教训|反思|亏麻|焦虑|心态|emo)/.test(normalized)) {
    hints.push("- 这次主要卡在___吗");
  }

  if (/(我觉得|本质|其实|不是.*而是|观点|立场|吐槽|问题在于|关键是)/.test(normalized)) {
    hints.push("- 你更想提醒大家___吗");
  }

  return hints.slice(0, 6).join("\n");
}

function createsReplyPressure(text) {
  const pressurePatterns = [
    /展开讲/,
    /详细说/,
    /细讲/,
    /系统讲/,
    /完整讲/,
    /说说为什么/,
    /方便分享/,
    /具体聊聊/,
    /展开说说/,
    /能细说/
  ];

  return pressurePatterns.some((pattern) => pattern.test(text));
}

function isOverTemplatedReply(text, sourceText) {
  const trimmed = text.trim();
  if (!startsWithShiBuShi(trimmed)) {
    return false;
  }

  if (isJudgmentHeavySource(sourceText)) {
    return false;
  }

  return true;
}

function startsWithShiBuShi(text) {
  return /^([^，。！？?？]{0,12}[，,])?\s*是不是/.test(text);
}

function isJudgmentHeavySource(sourceText) {
  if (!sourceText) {
    return false;
  }

  return /(看多|看空|必然|一定|更像|大概率|预期|判断|机会|风险|拐点|回补|见顶|补涨|站队|逻辑就是)/.test(sourceText);
}

function isQuestionLike(text) {
  if (/[?？]$/.test(text)) {
    return true;
  }

  const lowPressureQuestionPatterns = [
    /是不是/,
    /能不能/,
    /会不会/,
    /更像是/,
    /可以直接/,
    /算不算/,
    /对吗/,
    /吗$/,
    /呢$/,
    /吧$/
  ];

  return lowPressureQuestionPatterns.some((pattern) => pattern.test(text));
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
