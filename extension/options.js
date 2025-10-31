import { getSettings, saveSettings, maskKey } from './settings.js';

const form = document.getElementById('settings-form');
const apiBaseInput = document.getElementById('api-base');
const apiPathInput = document.getElementById('api-path');
const apiKeyInput = document.getElementById('api-key');
const modelInput = document.getElementById('model');
const temperatureInput = document.getElementById('temperature');
const status = document.getElementById('status');

let originalSettings = null;

async function testApi(settings) {
  const url = `${settings.apiBaseUrl.replace(/\/$/, '')}${settings.apiPath}`;
  const body = {
    model: settings.model,
    temperature: 0,
    max_tokens: 1,
    messages: [
      { role: 'system', content: 'You are a connectivity tester.' },
      { role: 'user', content: 'ping' }
    ]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`API responded ${response.status}: ${text?.slice(0, 200) || 'Unknown error'}`);
  }

  const data = await response.json().catch(() => ({}));
  if (!data || !Array.isArray(data.choices)) {
    throw new Error('Unexpected API response shape');
  }

  return true;
}

async function hydrate() {
  const settings = await getSettings();
  originalSettings = settings;
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

    // Saved message
    status.textContent = `Saved. Using ${settings.model} · Key ${maskKey(settings.apiKey)}`;

    // If API key changed (or was newly set), trigger a quick connectivity test
    const keyChanged = !originalSettings || originalSettings.apiKey !== settings.apiKey;
    if (settings.apiKey && keyChanged) {
      status.textContent = `Saved. Testing API… Using ${settings.model} · Key ${maskKey(settings.apiKey)}`;
      try {
        await testApi(settings);
        status.textContent = `Saved. API test passed ✅ · Using ${settings.model} · Key ${maskKey(settings.apiKey)}`;
      } catch (e) {
        console.error('API test failed:', e);
        status.textContent = `Saved, but API test failed: ${e.message || e}`;
      }
    }
    // Update in-memory baseline after save
    originalSettings = settings;
  } catch (error) {
    console.error(error);
    status.textContent = 'Failed to save settings.';
  }
});

hydrate().catch((error) => {
  console.error('Failed to load settings', error);
  status.textContent = 'Failed to load settings. Check the console.';
});
