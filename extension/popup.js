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

const sourceInput = document.getElementById('source-text');
const translateButton = document.getElementById('translate-btn');
const clearButton = document.getElementById('clear-btn');
const resultSection = document.getElementById('result-section');
const statusLabel = document.getElementById('status-label');
const originalText = document.getElementById('original-text');
const formattedTranslation = document.getElementById('formatted-translation');
const copyButton = document.getElementById('copy-btn');
const glossaryList = document.getElementById('glossary-list');

translateButton.addEventListener('click', async () => {
  const text = (sourceInput.value || '').trim();
  if (!text) {
    statusLabel.textContent = '请输入要翻译的文本';
    resultSection.hidden = false;
    originalText.textContent = '';
    formattedTranslation.textContent = '';
    return;
  }
  setLoadingState(true);
  resultSection.hidden = false;
  originalText.textContent = text;
  formattedTranslation.innerHTML = '<span class="loading">正在请求翻译...</span>';
  statusLabel.textContent = '翻译中...';

  chrome.runtime.sendMessage(
    {
      type: 'RIES_REQUEST_TRANSLATION',
      text
    },
    (response) => {
      setLoadingState(false);
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        formattedTranslation.innerHTML = `<span class="error">${escapeHtml(lastError.message || '翻译失败')}</span>`;
        statusLabel.textContent = '发生错误';
        return;
      }
      if (!response?.success) {
        formattedTranslation.innerHTML = `<span class="error">${escapeHtml(response?.error || '翻译失败')}</span>`;
        statusLabel.textContent = '发生错误';
        return;
      }

      formattedTranslation.innerHTML = response.result.formatted;
      formattedTranslation.dataset.raw = response.result.translation;
      const replacements = Array.isArray(response.result.replacements)
        ? response.result.replacements
        : [];
      if (replacements.length) {
        statusLabel.textContent = `已替换 ${replacements.length} 个术语`;
      } else {
        statusLabel.textContent = '未匹配到术语';
      }
    }
  );
});

clearButton.addEventListener('click', () => {
  sourceInput.value = '';
  originalText.textContent = '';
  formattedTranslation.textContent = '';
  resultSection.hidden = true;
});

copyButton.addEventListener('click', async () => {
  const text = formattedTranslation.dataset.raw || formattedTranslation.innerText || '';
  if (!text) {
    statusLabel.textContent = '没有可复制的内容';
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    statusLabel.textContent = '已复制';
  } catch (error) {
    console.error('复制失败', error);
    statusLabel.textContent = '复制失败';
  }
});

function setLoadingState(isLoading) {
  translateButton.disabled = isLoading;
  clearButton.disabled = isLoading;
  copyButton.disabled = isLoading;
  if (isLoading) {
    translateButton.textContent = '翻译中...';
  } else {
    translateButton.textContent = '翻译';
  }
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

function renderGlossary(settings) {
  const glossary = settings?.glossary || [];
  glossaryList.innerHTML = '';
  if (!glossary.length) {
    const empty = document.createElement('li');
    empty.textContent = '暂未配置术语。请在选项页添加。';
    empty.className = 'empty';
    glossaryList.appendChild(empty);
    return;
  }

  glossary.forEach((item) => {
    if (!item?.zh || !item?.en) {
      return;
    }
    const li = document.createElement('li');
    li.innerHTML = `<span>${escapeHtml(item.zh)}</span>${escapeHtml(item.en)}`;
    glossaryList.appendChild(li);
  });
}

function bootstrap() {
  chrome.storage.sync.get(STORAGE_KEY, (data) => {
    const settings = data?.[STORAGE_KEY] || DEFAULT_SETTINGS;
    renderGlossary(settings);
  });
}

document.addEventListener('DOMContentLoaded', bootstrap);
