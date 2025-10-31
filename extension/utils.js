export function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function sanitizeHtml(text) {
  if (typeof text !== 'string') {
    return '';
  }
  return escapeHtml(text);
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function wrapWithAnnotations(translation, replacements) {
  let html = sanitizeHtml(translation);

  for (const replacement of replacements) {
    const english = replacement?.english?.trim();
    const chinese = replacement?.chinese?.trim();

    if (!english || !chinese) {
      continue;
    }

    const pattern = new RegExp(`\\b${escapeRegExp(english)}\\b`, 'g');
    html = html.replace(pattern, (match) => {
      const safeEnglish = sanitizeHtml(match);
      const safeChinese = sanitizeHtml(chinese);
      return `<span class="ries-annotated">${safeEnglish}(${safeChinese})</span>`;
    });
  }

  return html;
}
