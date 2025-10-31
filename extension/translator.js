import { wrapWithAnnotations } from './utils.js';

class TranslationError extends Error {
  constructor(message, details) {
    super(message);
    this.name = 'TranslationError';
    this.details = details;
  }
}

function buildPrompt(text) {
  return [
    {
      role: 'system',
      content:
        'You are an expert bilingual translator specialising in business, marketing, and startup terminology. Translate the provided Chinese text into natural, fluent English. Identify key domain-specific nouns, company names, and marketing concepts, and map them to concise English terminology. Return a minified JSON object with keys "translation" and "replacements". The translation string MUST contain the exact English terms that appear in the replacements list. The replacements value must be an array of objects of the form {"english":"term","chinese":"原词"}. Respond with JSON only.'
    },
    {
      role: 'user',
      content: text
    }
  ];
}

async function callChatCompletion(text, settings) {
  const body = {
    model: settings.model,
    temperature: settings.temperature,
    messages: buildPrompt(text)
  };

  const response = await fetch(`${settings.apiBaseUrl.replace(/\/$/, '')}${settings.apiPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new TranslationError('Upstream API responded with an error', {
      status: response.status,
      body: errorText
    });
  }

  const data = await response.json();
  const message = data?.choices?.[0]?.message?.content;

  if (!message) {
    throw new TranslationError('No translation returned from API', data);
  }

  let parsed;
  try {
    parsed = JSON.parse(message);
  } catch (error) {
    throw new TranslationError('Failed to parse translation JSON', message);
  }

  const translation = parsed.translation?.trim();
  const replacements = Array.isArray(parsed.replacements) ? parsed.replacements : [];

  if (!translation) {
    throw new TranslationError('Translation text is missing from API response', parsed);
  }

  return { translation, replacements };
}

export async function translateWithReplacements(text, settings) {
  if (!settings.apiKey) {
    throw new TranslationError('API key is missing. Please set it in the extension options.');
  }

  const { translation, replacements } = await callChatCompletion(text, settings);
  const translationHtml = wrapWithAnnotations(translation, replacements);

  return {
    translation,
    translationHtml,
    replacements
  };
}

export { TranslationError };
