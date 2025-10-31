import { getSettings, saveSettings, maskKey } from './settings.js';

const form = document.getElementById('settings-form');
const apiBaseInput = document.getElementById('api-base');
const apiPathInput = document.getElementById('api-path');
const apiKeyInput = document.getElementById('api-key');
const modelInput = document.getElementById('model');
const temperatureInput = document.getElementById('temperature');
const status = document.getElementById('status');

async function hydrate() {
  const settings = await getSettings();
  apiBaseInput.value = settings.apiBaseUrl;
  apiPathInput.value = settings.apiPath;
  apiKeyInput.value = settings.apiKey;
  modelInput.value = settings.model;
  temperatureInput.value = settings.temperature;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  status.textContent = 'Saving…';

  try {
    const settings = await saveSettings({
      apiBaseUrl: apiBaseInput.value.trim(),
      apiPath: apiPathInput.value.trim() || '/v1/chat/completions',
      apiKey: apiKeyInput.value.trim(),
      model: modelInput.value.trim(),
      temperature: Number.parseFloat(temperatureInput.value) || 0.2
    });

    status.textContent = `Saved. Using ${settings.model} · Key ${maskKey(settings.apiKey)}`;
  } catch (error) {
    console.error(error);
    status.textContent = 'Failed to save settings.';
  }
});

hydrate().catch((error) => {
  console.error('Failed to load settings', error);
  status.textContent = 'Failed to load settings. Check the console.';
});
