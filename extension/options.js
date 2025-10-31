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

const form = document.getElementById('settings-form');
const status = document.getElementById('status');
const glossaryContainer = document.getElementById('glossary-container');
const addTermButton = document.getElementById('add-term');
const resetButton = document.getElementById('reset-defaults');

function init() {
  chrome.storage.sync.get(STORAGE_KEY, (data) => {
    const settings = data?.[STORAGE_KEY] || DEFAULT_SETTINGS;
    populateForm(settings);
  });

  form.addEventListener('submit', onSubmit);
  addTermButton.addEventListener('click', () => addGlossaryRow());
  resetButton.addEventListener('click', () => {
    populateForm(DEFAULT_SETTINGS);
    showStatus('已恢复默认设置。保存后方可生效。');
  });
}

document.addEventListener('DOMContentLoaded', init);

function populateForm(settings) {
  form.apiBaseUrl.value = settings.apiBaseUrl || DEFAULT_SETTINGS.apiBaseUrl;
  form.apiKey.value = settings.apiKey || '';
  form.model.value = settings.model || DEFAULT_SETTINGS.model;
  form.temperature.value =
    typeof settings.temperature === 'number' ? settings.temperature : DEFAULT_SETTINGS.temperature;

  renderGlossary(settings.glossary || []);
}

function renderGlossary(glossary) {
  glossaryContainer.innerHTML = '';
  if (!glossary.length) {
    addGlossaryRow();
    return;
  }
  glossary.forEach((item) => addGlossaryRow(item.zh, item.en));
}

function addGlossaryRow(zh = '', en = '') {
  const row = document.createElement('div');
  row.className = 'glossary-row';
  row.innerHTML = `
    <input type="text" class="zh" placeholder="中文术语" value="${escapeHtml(zh)}" />
    <input type="text" class="en" placeholder="English term" value="${escapeHtml(en)}" />
    <button type="button" class="remove">删除</button>
  `;
  row.querySelector('.remove').addEventListener('click', () => {
    row.remove();
    if (!glossaryContainer.querySelector('.glossary-row')) {
      addGlossaryRow();
    }
  });
  glossaryContainer.appendChild(row);
}

function onSubmit(event) {
  event.preventDefault();
  const formData = new FormData(form);
  const apiBaseUrl = (formData.get('apiBaseUrl') || '').trim();
  const apiKey = (formData.get('apiKey') || '').trim();
  const model = (formData.get('model') || '').trim();
  const temperature = parseFloat(formData.get('temperature'));

  if (!apiBaseUrl || !model) {
    showStatus('请至少填写 Base URL 与模型名称。API Key 可留空以仅使用术语替换。', true);
    return;
  }

  const glossary = [...glossaryContainer.querySelectorAll('.glossary-row')].map((row) => {
    const zh = row.querySelector('.zh').value.trim();
    const en = row.querySelector('.en').value.trim();
    return { zh, en };
  });

  const invalidEntry = glossary.find((item) => (!item.zh && item.en) || (item.zh && !item.en));
  if (invalidEntry) {
    showStatus('请确保每个术语同时包含中文和英文。', true);
    return;
  }

  const filteredGlossary = glossary.filter((item) => item.zh && item.en);

  const payload = {
    apiBaseUrl,
    apiKey,
    model,
    temperature: Number.isFinite(temperature) ? temperature : DEFAULT_SETTINGS.temperature,
    glossary: filteredGlossary
  };

  chrome.storage.sync.set({ [STORAGE_KEY]: payload }, () => {
    showStatus('设置已保存。');
  });
}

function showStatus(message, isError = false) {
  status.textContent = message;
  status.classList.toggle('error', Boolean(isError));
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
