const STYLE_ID = 'ries-glossary-style';
const OVERLAY_ID = 'ries-glossary-overlay';

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'RIES_TRANSLATE_SELECTION') {
    const selection = message.text || window.getSelection()?.toString();
    if (!selection || !selection.trim()) {
      showOverlay({
        original: '',
        formatted: '<em>请先选择需要翻译的中文文本。</em>',
        translation: '',
        isError: true
      });
      return;
    }

    showOverlay({
      original: selection,
      formatted: '<span class="ries-loading">正在请求翻译...</span>',
      translation: '',
      isLoading: true
    });

    chrome.runtime.sendMessage(
      {
        type: 'RIES_REQUEST_TRANSLATION',
        text: selection
      },
      (response) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          console.error('翻译请求失败', lastError);
          showOverlay({
            original: selection,
            formatted: `<span class="ries-error">${escapeHtml(lastError.message || '翻译失败')}</span>`,
            translation: '',
            isError: true
          });
          return;
        }
        if (!response?.success) {
          showOverlay({
            original: selection,
            formatted: `<span class="ries-error">${escapeHtml(response?.error || '翻译失败')}</span>`,
            translation: '',
            isError: true
          });
          return;
        }

        showOverlay({
          original: response.result.original,
          formatted: response.result.formatted,
          translation: response.result.translation,
          isError: false
        });
      }
    );
  }
});

function showOverlay({ original, formatted, translation, isError, isLoading }) {
  ensureStyles();
  let overlay = document.getElementById(OVERLAY_ID);
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = OVERLAY_ID;
    overlay.innerHTML = getOverlayTemplate();
    document.body.appendChild(overlay);

    overlay.querySelector('.ries-close').addEventListener('click', () => {
      overlay.remove();
    });

    overlay.querySelector('.ries-copy').addEventListener('click', async () => {
      const copyTarget = overlay.querySelector('.ries-translation-text');
      const textToCopy = copyTarget?.dataset?.raw || copyTarget?.innerText || '';
      try {
        await navigator.clipboard.writeText(textToCopy);
        showCopyStatus(overlay, '已复制');
      } catch (error) {
        showCopyStatus(overlay, '复制失败');
        console.error('复制失败', error);
      }
    });
  }

  const originalEl = overlay.querySelector('.ries-original-text');
  const translationEl = overlay.querySelector('.ries-translation-text');
  const statusEl = overlay.querySelector('.ries-status');

  originalEl.textContent = original || '';
  translationEl.innerHTML = formatted || '';
  translationEl.dataset.raw = translation || '';

  if (isLoading) {
    overlay.classList.add('ries-loading-state');
    statusEl.textContent = '翻译中...';
  } else {
    overlay.classList.remove('ries-loading-state');
    statusEl.textContent = isError ? '发生错误' : '翻译完成';
  }

  overlay.style.display = 'block';
}

function showCopyStatus(overlay, text) {
  const status = overlay.querySelector('.ries-copy-status');
  status.textContent = text;
  status.classList.add('visible');
  setTimeout(() => {
    status.classList.remove('visible');
  }, 1500);
}

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    #${OVERLAY_ID} {
      position: fixed;
      top: 24px;
      right: 24px;
      width: min(420px, 90vw);
      max-height: 70vh;
      overflow: hidden;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
      border-radius: 12px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #ffffff;
      color: #1f2937;
      z-index: 2147483647;
      display: none;
      border: 1px solid rgba(15, 118, 110, 0.25);
    }

    #${OVERLAY_ID} .ries-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      background: linear-gradient(120deg, #0ea5e9 0%, #0f766e 100%);
      color: #ffffff;
      font-weight: 600;
    }

    #${OVERLAY_ID} .ries-body {
      padding: 12px 16px 16px;
      overflow-y: auto;
      max-height: calc(70vh - 120px);
    }

    #${OVERLAY_ID} .ries-section {
      margin-bottom: 12px;
    }

    #${OVERLAY_ID} .ries-label {
      font-size: 12px;
      text-transform: uppercase;
      color: #0f766e;
      letter-spacing: 0.08em;
      margin-bottom: 4px;
    }

    #${OVERLAY_ID} .ries-content {
      background: #f8fafc;
      border-radius: 8px;
      padding: 12px;
      line-height: 1.6;
      font-size: 14px;
      white-space: pre-wrap;
      word-break: break-word;
    }

    #${OVERLAY_ID} .ries-controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-top: 1px solid rgba(15, 118, 110, 0.15);
      background: #f1f5f9;
      gap: 12px;
    }

    #${OVERLAY_ID} .ries-close,
    #${OVERLAY_ID} .ries-copy {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 14px;
      border-radius: 6px;
      padding: 6px 10px;
      transition: background 0.2s ease, color 0.2s ease;
    }

    #${OVERLAY_ID} .ries-close {
      color: rgba(255, 255, 255, 0.9);
    }

    #${OVERLAY_ID} .ries-close:hover {
      color: #ffffff;
    }

    #${OVERLAY_ID} .ries-copy {
      background: #0ea5e9;
      color: #ffffff;
    }

    #${OVERLAY_ID} .ries-copy:hover {
      background: #0284c7;
    }

    #${OVERLAY_ID} .ries-status {
      font-size: 12px;
      color: #0f172a;
    }

    #${OVERLAY_ID} .ries-copy-status {
      font-size: 12px;
      color: #0f766e;
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    #${OVERLAY_ID} .ries-copy-status.visible {
      opacity: 1;
    }

    #${OVERLAY_ID} .ries-glossary-term {
      text-decoration: underline;
      text-decoration-thickness: 2px;
      text-underline-offset: 4px;
      font-weight: 600;
      color: #0f172a;
    }

    #${OVERLAY_ID} .ries-loading {
      color: #0ea5e9;
    }

    #${OVERLAY_ID} .ries-error {
      color: #dc2626;
      font-weight: 600;
    }

    #${OVERLAY_ID}.ries-loading-state .ries-copy {
      opacity: 0.5;
      pointer-events: none;
    }
  `;
  document.head.appendChild(style);
}

function getOverlayTemplate() {
  return `
    <div class="ries-header">
      <span>Ries Glossary 翻译</span>
      <button class="ries-close" title="关闭">✕</button>
    </div>
    <div class="ries-body">
      <div class="ries-section">
        <div class="ries-label">原文</div>
        <div class="ries-content ries-original-text"></div>
      </div>
      <div class="ries-section">
        <div class="ries-label">翻译</div>
        <div class="ries-content ries-translation-text"></div>
      </div>
    </div>
    <div class="ries-controls">
      <span class="ries-status">准备就绪</span>
      <div style="display:flex; gap:8px; align-items:center;">
        <span class="ries-copy-status"></span>
        <button class="ries-copy">复制翻译</button>
      </div>
    </div>
  `;
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
