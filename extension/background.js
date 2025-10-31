const STORAGE_KEY = 'riesSettings';

const DEFAULT_SETTINGS = {
  apiBaseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  temperature: 0.2,
  glossary: [
    { zh: '人工智能', en: 'artificial intelligence' },
    { zh: '大语言模型', en: 'large language model' },
    { zh: '机器学习', en: 'machine learning' }
  ]
};

chrome.runtime.onInstalled.addListener(async () => {
  const stored = await chrome.storage.sync.get(STORAGE_KEY);
  if (!stored[STORAGE_KEY]) {
    await chrome.storage.sync.set({ [STORAGE_KEY]: DEFAULT_SETTINGS });
  }

  registerContextMenu();
});

registerContextMenu();

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== 'ries-translate-selection' || !info.selectionText || !tab?.id) {
    return;
  }

  chrome.tabs.sendMessage(tab.id, {
    type: 'RIES_TRANSLATE_SELECTION',
    text: info.selectionText
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'RIES_REQUEST_TRANSLATION') {
    translate(message.text)
      .then((result) => sendResponse({ success: true, result }))
      .catch((error) => sendResponse({ success: false, error: error.message }));
    return true;
  }
  return undefined;
});

async function translate(text) {
  if (!text || !text.trim()) {
    throw new Error('没有可翻译的内容');
  }

  const { [STORAGE_KEY]: settings = DEFAULT_SETTINGS } = await chrome.storage.sync.get(STORAGE_KEY);
  const {
    apiBaseUrl,
    apiKey,
    model,
    temperature,
    glossary
  } = {
    ...DEFAULT_SETTINGS,
    ...settings
  };

  if (!apiKey) {
    throw new Error('请先在扩展选项中配置 API Key');
  }

  const url = `${apiBaseUrl.replace(/\/$/, '')}/chat/completions`;
  const prompt = buildGlossaryPrompt(glossary || []);

  const body = {
    model,
    temperature,
    messages: [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: `You are a bilingual translator who always outputs English translations. When translating Chinese to English you MUST follow these rules:\n1. The output should be natural English.\n2. For each glossary term provide the exact English translation specified and immediately append the original Chinese in parentheses.\n3. Surround each glossary substitution with underscores ( _ ) so the renderer can underline it.\n4. Do not output additional commentary.`
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `${prompt}\n\nTranslate the following Chinese text to English using the rules above:\n\n${text}`
          }
        ]
      }
    ]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM 请求失败: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  const translation = data?.choices?.[0]?.message?.content?.trim();

  if (!translation) {
    throw new Error('未获取到翻译结果');
  }

  const formatted = underlineGlossary(translation, glossary || []);

  return {
    original: text,
    translation,
    formatted,
    glossary: glossary || []
  };
}

function buildGlossaryPrompt(glossary) {
  if (!glossary.length) {
    return 'There is no glossary to enforce.';
  }
  const items = glossary
    .filter((item) => item?.zh && item?.en)
    .map((item, index) => `${index + 1}. ${item.zh} -> ${item.en}`)
    .join('\n');
  return `Always apply the following glossary mappings (Chinese -> English) exactly and append the original Chinese in parentheses after the translated term:\n${items}`;
}

function underlineGlossary(translation, glossary) {
  if (!Array.isArray(glossary) || glossary.length === 0) {
    return escapeHtml(translation);
  }

  let formatted = escapeHtml(translation);

  glossary.forEach((item) => {
    if (!item?.zh || !item?.en) {
      return;
    }
    const pattern = new RegExp(`${escapeRegExp(item.en)}\\(${escapeRegExp(item.zh)}\\)`, 'g');
    formatted = formatted.replace(
      pattern,
      (match) => `<span class="ries-glossary-term">${match}</span>`
    );
  });

  return formatted
    .replace(/_(<span class="ries-glossary-term">.*?<\/span>)_/g, '<span class="ries-glossary-term">$1</span>')
    .replace(/\n/g, '<br />');
}

function registerContextMenu() {
  chrome.contextMenus.create(
    {
      id: 'ries-translate-selection',
      title: 'Ries Glossary 翻译选中内容',
      contexts: ['selection']
    },
    () => {
      const error = chrome.runtime.lastError;
      if (error && !/Cannot create item with duplicate id/.test(error.message)) {
        console.warn('无法创建上下文菜单:', error);
      }
    }
  );
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
