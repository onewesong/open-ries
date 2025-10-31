(function () {
  const OVERLAY_ID = 'ries-translation-overlay';

  function ensureStyles() {
    if (document.getElementById('ries-translation-style')) {
      return;
    }

    const style = document.createElement('style');
    style.id = 'ries-translation-style';
    style.textContent = `
      #${OVERLAY_ID} {
        position: fixed;
        bottom: 24px;
        right: 24px;
        max-width: min(480px, calc(100vw - 48px));
        background: #101828;
        color: #f8fafc;
        padding: 16px 20px;
        border-radius: 12px;
        box-shadow: 0 12px 32px rgba(15, 23, 42, 0.35);
        font-family: 'Inter', 'SF Pro Display', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        line-height: 1.5;
        z-index: 2147483647;
      }

      #${OVERLAY_ID} strong {
        font-size: 14px;
        letter-spacing: 0.02em;
        text-transform: uppercase;
        color: #9bb5ff;
      }

      #${OVERLAY_ID} .ries-body {
        margin-top: 8px;
        font-size: 15px;
        color: #f1f5f9;
      }

      #${OVERLAY_ID} .ries-meta {
        margin-top: 12px;
        font-size: 13px;
        color: #cbd5f5;
        display: flex;
        justify-content: space-between;
        gap: 16px;
      }

      #${OVERLAY_ID} .ries-close {
        position: absolute;
        top: 8px;
        right: 10px;
        background: transparent;
        border: none;
        color: #94a3b8;
        cursor: pointer;
        font-size: 18px;
      }

      #${OVERLAY_ID} .ries-close:hover {
        color: #f1f5f9;
      }

      #${OVERLAY_ID} .ries-annotated {
        text-decoration: underline;
        text-decoration-style: dashed;
        text-decoration-thickness: 2px;
        text-decoration-color: rgba(148, 163, 184, 0.7);
        color: #fefefe;
        font-weight: 600;
        padding-bottom: 1px;
      }

      #${OVERLAY_ID}.ries-loading::after {
        content: 'Thinking…';
        display: block;
        color: #e2e8f0;
        font-style: italic;
        margin-top: 8px;
      }
    `;

    document.head.appendChild(style);
  }

  function removeOverlay() {
    const existing = document.getElementById(OVERLAY_ID);
    if (existing) {
      existing.remove();
    }
  }

  function renderOverlay(state) {
    ensureStyles();
    removeOverlay();

    const container = document.createElement('div');
    container.id = OVERLAY_ID;
    container.classList.toggle('ries-loading', state.status === 'loading');

    const closeButton = document.createElement('button');
    closeButton.className = 'ries-close';
    closeButton.innerText = '×';
    closeButton.addEventListener('click', removeOverlay);
    container.appendChild(closeButton);

    const title = document.createElement('strong');
    title.innerText = 'Ries Terminology Translate';
    container.appendChild(title);

    const body = document.createElement('div');
    body.className = 'ries-body';

    if (state.status === 'loading') {
      body.innerText = 'Calling the language model…';
    } else if (state.status === 'error') {
      body.innerText = state.message || 'Translation failed.';
    } else {
      body.innerHTML = state.translationHtml;
    }

    container.appendChild(body);

    if (state.status === 'ready' && Array.isArray(state.replacements) && state.replacements.length > 0) {
      const meta = document.createElement('div');
      meta.className = 'ries-meta';
      meta.innerHTML = `
        <span>${state.replacements.length} glossary term${state.replacements.length > 1 ? 's' : ''}</span>
        <span>LLM · ${new Date().toLocaleTimeString()}</span>
      `;
      container.appendChild(meta);
    }

    document.body.appendChild(container);
  }

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || typeof message.type !== 'string') {
      return;
    }

    switch (message.type) {
      case 'RIES_TRANSLATION_STARTED':
        renderOverlay({ status: 'loading' });
        break;
      case 'RIES_TRANSLATION_RESULT':
        renderOverlay({
          status: 'ready',
          translationHtml: message.payload.translationHtml,
          replacements: message.payload.replacements || []
        });
        break;
      case 'RIES_TRANSLATION_ERROR':
        renderOverlay({
          status: 'error',
          message: message.payload?.message
        });
        break;
      default:
        break;
    }
  });
})();
