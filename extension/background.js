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

  const normalizedGlossary = Array.isArray(glossary) ? glossary.filter((item) => item?.zh && item?.en) : [];
  const partialResult = buildPartialReplacement(text, normalizedGlossary);

  let llmResult = null;
  if (apiKey) {
    try {
      llmResult = await requestFullTranslation({
        apiBaseUrl,
        apiKey,
        model,
        temperature,
        text,
        glossary: normalizedGlossary
      });
    } catch (error) {
      console.warn('LLM 翻译失败，已仅返回术语替换结果:', error);
    }
  }

  return {
    original: text,
    translation: partialResult.plain,
    formatted: partialResult.html,
    glossary: normalizedGlossary,
    segments: partialResult.segments,
    replacements: partialResult.replacements,
    fullTranslation: llmResult?.translation || '',
    fullFormatted: llmResult?.formatted || ''
  };
}

async function requestFullTranslation({ apiBaseUrl, apiKey, model, temperature, text, glossary }) {
  const url = `${apiBaseUrl.replace(/\/$/, '')}/chat/completions`;
  const prompt = buildGlossaryPrompt(glossary);

  const body = {
    model,
    temperature,
    messages: [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text: `You are a bilingual translator. When working with Chinese text you must keep the sentence structure natural in English. For any glossary mapping, output "English(中文)" and wrap it with underscores so it can be underlined later.`
          }
        ]
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `${prompt}\n\nTranslate the following Chinese text to English:\n\n${text}`
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

  const formatted = underlineGlossary(translation, glossary);

  return { translation, formatted };
}

function buildGlossaryPrompt(glossary) {
  if (!glossary.length) {
    return 'There is no glossary to enforce.';
  }
  const items = glossary.map((item, index) => `${index + 1}. ${item.zh} -> ${item.en}`).join('\n');
  return `Always apply the following glossary mappings (Chinese -> English) exactly and append the original Chinese in parentheses after the translated term:\n${items}`;
}

function underlineGlossary(translation, glossary) {
  if (!Array.isArray(glossary) || glossary.length === 0) {
    return escapeHtml(translation).replace(/\n/g, '<br />');
  }

  let formatted = escapeHtml(translation);

  glossary.forEach((item) => {
    const pattern = new RegExp(`${escapeRegExp(item.en)}\(${escapeRegExp(item.zh)}\)`, 'g');
    formatted = formatted.replace(
      pattern,
      (match) => `<span class="ries-glossary-term">${match}</span>`
    );
  });

  return formatted
    .replace(/_(<span class="ries-glossary-term">.*?<\/span>)_/g, '<span class="ries-glossary-term">$1</span>')
    .replace(/\n/g, '<br />');
}

function buildPartialReplacement(text, glossary) {
  if (!glossary.length) {
    const escaped = escapeHtml(text).replace(/\n/g, '<br />');
    return {
      segments: [{ type: 'text', text }],
      html: escaped,
      plain: text,
      replacements: []
    };
  }

  const matches = collectGlossaryMatches(text, glossary);
  if (!matches.length) {
    const escaped = escapeHtml(text).replace(/\n/g, '<br />');
    return {
      segments: [{ type: 'text', text }],
      html: escaped,
      plain: text,
      replacements: []
    };
  }

  const segments = [];
  const replacements = [];
  let cursor = 0;

  matches.forEach((match) => {
    if (cursor < match.start) {
      segments.push({ type: 'text', text: text.slice(cursor, match.start) });
    }
    segments.push({ type: 'glossary', zh: match.zh, en: match.en });
    replacements.push({ zh: match.zh, en: match.en });
    cursor = match.end;
  });

  if (cursor < text.length) {
    segments.push({ type: 'text', text: text.slice(cursor) });
  }

  const plain = segments
    .map((segment) => (segment.type === 'glossary' ? `${segment.en}(${segment.zh})` : segment.text))
    .join('');

  const html = segments
    .map((segment) => {
      if (segment.type === 'glossary') {
        const label = `${segment.en}(${segment.zh})`;
        return `<span class="ries-glossary-inline" data-zh="${escapeHtml(segment.zh)}" data-en="${escapeHtml(segment.en)}">${escapeHtml(label)}</span>`;
      }
      return escapeHtml(segment.text).replace(/\n/g, '<br />');
    })
    .join('');

  return { segments, html, plain, replacements };
}

function collectGlossaryMatches(text, glossary) {
  const matches = [];
  glossary
    .slice()
    .sort((a, b) => b.zh.length - a.zh.length)
    .forEach((item) => {
      const pattern = new RegExp(escapeRegExp(item.zh), 'g');
      let match;
      while ((match = pattern.exec(text)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + item.zh.length,
          zh: item.zh,
          en: item.en
        });
      }
    });

  matches.sort((a, b) => {
    if (a.start === b.start) {
      return b.end - a.end;
    }
    return a.start - b.start;
  });

  const filtered = [];
  let lastEnd = -1;
  matches.forEach((match) => {
    if (match.start >= lastEnd) {
      filtered.push(match);
      lastEnd = match.end;
    }
  });

  return filtered;
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
  if (typeof text !== 'string') {
    return '';
  }
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
