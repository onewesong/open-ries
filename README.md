# Ries Terminology Translator Extension

A Chromium browser extension inspired by [ries.ai](https://ries.ai/zh/learn-english) that calls a configurable large language model to translate Chinese text. Domain-specific Chinese terminology is replaced with the corresponding English terms while keeping the original words in parentheses and applying an underline for quick reference.

## Features

- Context-menu translation for any selected Chinese text on the web.
- Popup translator that works without leaving the current tab.
- Glossary overlay that underlines key terms in the translated text as `English(中文)`.
- Options page to configure any OpenAI-compatible chat completion endpoint (base URL, path, API key, model, and temperature).
- Works with OpenAI, Azure OpenAI, Together AI, or self-hosted LLM gateways that implement the Chat Completions API.

## Loading the Extension Locally

1. Open `chrome://extensions` (or the equivalent page in Microsoft Edge/Brave).
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select the `extension` directory from this repository.
4. Open the extension popup and click **Configure API…** to set your endpoint credentials.
5. Highlight Chinese text on any page, right-click, and choose **Translate selection with Ries glossary** to see the annotated translation overlay.

## Configuring the LLM Endpoint

The extension expects an OpenAI-compatible Chat Completions endpoint. Provide the base URL, path, API key, model name, and temperature on the options page. By default the extension uses:

- Base URL: `https://api.openai.com`
- Path: `/v1/chat/completions`
- Model: `gpt-4o-mini`
- Temperature: `0.2`

You can point the extension to Azure OpenAI, OpenRouter, or a self-hosted model gateway as long as it accepts the same payload shape.

## Privacy

Only the text you choose to translate is sent to the configured LLM endpoint. No analytics or additional telemetry is collected.
