import { maskKey } from './settings.js';

const sourceInput = document.getElementById('source');
const translateButton = document.getElementById('translate');
const openOptionsLink = document.getElementById('open-options');
const resultSection = document.getElementById('result');
const resultOutput = document.getElementById('translation-output');
const terminologyList = document.getElementById('terminology-list');
const errorSection = document.getElementById('error');

function resetState() {
  resultSection.classList.add('hidden');
  errorSection.classList.add('hidden');
  terminologyList.innerHTML = '';
  resultOutput.innerHTML = '';
}

function renderTerminology(replacements) {
  terminologyList.innerHTML = '';
  for (const item of replacements) {
    const li = document.createElement('li');
    const english = document.createElement('span');
    const chinese = document.createElement('span');
    english.textContent = item.english;
    chinese.textContent = item.chinese;
    li.appendChild(english);
    li.appendChild(chinese);
    terminologyList.appendChild(li);
  }
}

function showError(message) {
  errorSection.textContent = message;
  errorSection.classList.remove('hidden');
}

function showResult(data) {
  resultOutput.innerHTML = data.translationHtml;
  renderTerminology(data.replacements || []);
  resultSection.classList.remove('hidden');
}

function setLoading(isLoading) {
  translateButton.disabled = isLoading;
  translateButton.textContent = isLoading ? 'Translating…' : 'Translate';
}

async function requestTranslation(text) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type: 'RIES_TRANSLATE_TEXT', text }, (response) => {
      if (!response) {
        reject(new Error('No response from background script. Check your permissions.'));
      } else if (!response.ok) {
        reject(new Error(response.error || 'Translation failed.'));
      } else {
        resolve(response.data);
      }
    });
  });
}

translateButton.addEventListener('click', async () => {
  const text = sourceInput.value.trim();
  if (!text) {
    showError('请先输入要翻译的中文内容。');
    return;
  }

  resetState();
  setLoading(true);

  try {
    const data = await requestTranslation(text);
    showResult(data);
  } catch (error) {
    console.error(error);
    showError(error.message);
  } finally {
    setLoading(false);
  }
});

openOptionsLink.addEventListener('click', (event) => {
  event.preventDefault();
  chrome.runtime.openOptionsPage();
});

chrome.storage.sync.get(null, (items) => {
  const settings = items['ries-translator-settings'];
  if (!settings || !settings.apiKey) {
    showError('请在配置页设置大模型接口和 API Key。');
  } else {
    const masked = maskKey(settings.apiKey);
    const note = document.createElement('p');
    note.style.fontSize = '12px';
    note.style.color = '#94a3b8';
    note.textContent = `Using model ${settings.model} · Key ${masked}`;
    resultSection.parentElement.insertBefore(note, resultSection);
  }
});
