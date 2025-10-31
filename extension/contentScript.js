(function () {
  const OVERLAY_ID = 'ries-translation-overlay';
  const ICON_ID = 'ries-selection-icon';
  const TOOLTIP_ID = 'ries-selection-tooltip';
  const INLINE_CLASS = 'ries-inline-translation';
  const INLINE_LOADING_CLASS = 'ries-inline-loading';
  const INLINE_MAX_LENGTH = 400;

  let floatingIcon = null;
  let floatingTooltip = null;
  let hideTooltipTimer = null;
  let currentSelectionText = '';
  let activeRequest = null;
  let iconHovered = false;
  const translationCache = new Map();
  const pendingTranslations = new Map();

  let ctrlActive = false;
  let currentInline = null;
  let pendingCtrlEvent = null;
  let ctrlHoverRAF = null;

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

      #${ICON_ID} {
        position: absolute;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background: linear-gradient(135deg, #4c6ef5, #82aaff);
        color: #f8fafc;
        display: none;
        align-items: center;
        justify-content: center;
        box-shadow: 0 8px 18px rgba(15, 23, 42, 0.3);
        cursor: pointer;
        z-index: 2147483647;
        transition: transform 0.15s ease, box-shadow 0.15s ease;
        font-family: 'Inter', 'SF Pro Display', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        font-weight: 600;
        font-size: 16px;
      }

      #${ICON_ID}:hover {
        transform: scale(1.05);
        box-shadow: 0 10px 24px rgba(30, 64, 175, 0.35);
      }

      #${TOOLTIP_ID} {
        position: absolute;
        max-width: min(360px, calc(100vw - 32px));
        background: #0f172a;
        color: #e2e8f0;
        border-radius: 12px;
        padding: 14px 16px;
        box-shadow: 0 18px 40px rgba(15, 23, 42, 0.45);
        font-size: 14px;
        line-height: 1.5;
        display: none;
        z-index: 2147483647;
        border: 1px solid rgba(148, 163, 184, 0.18);
      }

      #${TOOLTIP_ID} strong {
        color: #cbd5f5;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        font-size: 12px;
        display: block;
        margin-bottom: 6px;
      }

      #${TOOLTIP_ID} .ries-annotated {
        text-decoration: underline;
        text-decoration-style: dashed;
        text-decoration-color: rgba(148, 163, 184, 0.55);
        font-weight: 600;
      }

      #${TOOLTIP_ID} .ries-tooltip-body {
        margin-top: 6px;
        color: #e2e8f0;
        word-break: break-word;
      }

      #${TOOLTIP_ID} .ries-tooltip-terms {
        margin-top: 10px;
        font-size: 12px;
        color: #94a3b8;
        display: grid;
        gap: 4px;
      }

      #${TOOLTIP_ID} .ries-tooltip-terms span {
        display: block;
      }

      #${TOOLTIP_ID}.ries-loading::after {
        content: 'Translating...';
        display: block;
        color: #94a3b8;
        font-style: italic;
        margin-top: 6px;
      }

      .${INLINE_CLASS} {
        display: inline;
        background: rgba(76, 110, 245, 0.15);
        color: inherit;
        border-radius: 6px;
        padding: 0 4px;
        transition: background 0.2s ease, color 0.2s ease;
      }

      .${INLINE_CLASS}.${INLINE_LOADING_CLASS} {
        background: rgba(148, 163, 184, 0.2);
        color: #94a3b8;
      }

      .${INLINE_CLASS} .ries-annotated {
        text-decoration: underline;
        text-decoration-style: dashed;
        text-decoration-color: rgba(148, 163, 184, 0.55);
        font-weight: 600;
      }
    `;

    document.head.appendChild(style);
  }

  function isWithinWidget(node) {
    let current = node;
    while (current) {
      if (current.nodeType === Node.ELEMENT_NODE) {
        if (
          current.id === ICON_ID ||
          current.id === TOOLTIP_ID ||
          current.id === OVERLAY_ID ||
          current.classList?.contains(INLINE_CLASS)
        ) {
          return true;
        }
      }
      current = current.parentNode;
    }
    return false;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => {
      switch (char) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        case "'":
          return '&#39;';
        default:
          return char;
      }
    });
  }

  function normalizeText(value) {
    return String(value ?? '').replace(/\s+/g, ' ').trim();
  }

  function isDisallowedTarget(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
      return true;
    }
    if (isWithinWidget(element)) {
      return true;
    }
    if (element.closest('script, style, textarea, input, button, select, svg, code, pre, noscript')) {
      return true;
    }
    return false;
  }

  function getInlineTargetFromPoint(clientX, clientY) {
    let range = null;
    if (document.caretRangeFromPoint) {
      range = document.caretRangeFromPoint(clientX, clientY);
    } else if (document.caretPositionFromPoint) {
      const caretPosition = document.caretPositionFromPoint(clientX, clientY);
      if (caretPosition) {
        range = document.createRange();
        range.setStart(caretPosition.offsetNode, caretPosition.offset);
        range.collapse(true);
      }
    }

    if (!range) {
      return null;
    }

    let node = range.startContainer;
    if (!node) {
      return null;
    }

    if (node.nodeType !== Node.TEXT_NODE) {
      node = node.childNodes?.[range.startOffset] || node.firstChild;
    }

    while (node && node.nodeType !== Node.TEXT_NODE && node.firstChild) {
      node = node.firstChild;
    }

    if (!node || node.nodeType !== Node.TEXT_NODE) {
      return null;
    }

    const parentElement = node.parentElement;
    if (isDisallowedTarget(parentElement)) {
      return null;
    }

    const originalText = node.textContent || '';
    const trimmed = originalText.trim();
    if (!trimmed) {
      return null;
    }

    const normalized = normalizeText(trimmed);

    if (!normalized || normalized.length > INLINE_MAX_LENGTH) {
      return null;
    }

    return {
      node,
      parentElement,
      originalText,
      normalized,
      translationText: trimmed
    };
  }

  function ensureIcon() {
    if (floatingIcon && floatingIcon.isConnected) {
      return floatingIcon;
    }

    floatingIcon = document.createElement('button');
    floatingIcon.id = ICON_ID;
    floatingIcon.type = 'button';
    floatingIcon.textContent = 'R';
    floatingIcon.setAttribute('aria-label', 'Translate selection');
    floatingIcon.addEventListener('mouseenter', handleIconMouseEnter);
    floatingIcon.addEventListener('mouseleave', handleIconMouseLeave);
    document.body.appendChild(floatingIcon);

    return floatingIcon;
  }

  function ensureTooltip() {
    if (floatingTooltip && floatingTooltip.isConnected) {
      return floatingTooltip;
    }

    floatingTooltip = document.createElement('div');
    floatingTooltip.id = TOOLTIP_ID;
    floatingTooltip.addEventListener('mouseenter', () => {
      if (hideTooltipTimer) {
        clearTimeout(hideTooltipTimer);
        hideTooltipTimer = null;
      }
    });
    floatingTooltip.addEventListener('mouseleave', () => {
      hideTooltip();
    });
    document.body.appendChild(floatingTooltip);

    return floatingTooltip;
  }

  function hideTooltip(delay = 120) {
    if (!floatingTooltip) {
      return;
    }
    if (hideTooltipTimer) {
      clearTimeout(hideTooltipTimer);
    }

    if (delay <= 0) {
      hideTooltipTimer = null;
      floatingTooltip.style.display = 'none';
      floatingTooltip.classList.remove('ries-loading');
      floatingTooltip.innerHTML = '';
      return;
    }

    hideTooltipTimer = setTimeout(() => {
      if (floatingTooltip) {
        floatingTooltip.style.display = 'none';
        floatingTooltip.classList.remove('ries-loading');
        floatingTooltip.innerHTML = '';
      }
      hideTooltipTimer = null;
    }, delay);
  }

  function showTooltip({ title = 'Ries Translate', html, text, loading = false }) {
    ensureStyles();
    const tooltip = ensureTooltip();
    if (hideTooltipTimer) {
      clearTimeout(hideTooltipTimer);
      hideTooltipTimer = null;
    }

    tooltip.classList.toggle('ries-loading', loading);

    const header = `<strong>${title}</strong>`;
    const bodyContent = html ? html : text || '';
    tooltip.innerHTML = `${header}<div class="ries-tooltip-body">${bodyContent}</div>`;
    tooltip.style.display = 'block';

    positionTooltip();
  }

  function positionTooltip() {
    if (!floatingIcon || !floatingTooltip) {
      return;
    }

    const iconRect = floatingIcon.getBoundingClientRect();
    const tooltipRect = floatingTooltip.getBoundingClientRect();
    const scrollY = window.scrollY || window.pageYOffset;
    const scrollX = window.scrollX || window.pageXOffset;

    let top = scrollY + iconRect.top - 6;
    let left = scrollX + iconRect.right + 12;

    const viewportRight = scrollX + window.innerWidth;
    if (left + tooltipRect.width > viewportRight - 8) {
      left = scrollX + iconRect.left - tooltipRect.width - 12;
    }

    const minTop = scrollY + 8;
    const maxTop = scrollY + window.innerHeight - tooltipRect.height - 8;
    top = clamp(top, minTop, maxTop);

    floatingTooltip.style.top = `${top}px`;
    floatingTooltip.style.left = `${left}px`;
  }

  function hideFloatingUI() {
    if (hideTooltipTimer) {
      clearTimeout(hideTooltipTimer);
      hideTooltipTimer = null;
    }
    if (floatingIcon) {
      floatingIcon.removeEventListener('mouseenter', handleIconMouseEnter);
      floatingIcon.removeEventListener('mouseleave', handleIconMouseLeave);
      floatingIcon.remove();
      floatingIcon = null;
    }
    if (floatingTooltip) {
      floatingTooltip.remove();
      floatingTooltip = null;
    }
    currentSelectionText = '';
    activeRequest = null;
    iconHovered = false;
  }

  function updateIconPosition(rect) {
    if (!floatingIcon) {
      return;
    }

    const iconSize = 32;
    const offset = 10;
    const scrollY = window.scrollY || window.pageYOffset;
    const scrollX = window.scrollX || window.pageXOffset;

    let top = scrollY + rect.top - iconSize - offset;
    let left = scrollX + rect.left + rect.width / 2 - iconSize / 2;

    const minTop = scrollY + 8;
    const maxTop = scrollY + window.innerHeight - iconSize - 8;
    const minLeft = scrollX + 8;
    const maxLeft = scrollX + window.innerWidth - iconSize - 8;

    top = clamp(top, minTop, maxTop);
    left = clamp(left, minLeft, maxLeft);

    floatingIcon.style.top = `${top}px`;
    floatingIcon.style.left = `${left}px`;
    floatingIcon.style.display = 'flex';
  }

  function showSelectionIcon(rect, text) {
    ensureStyles();
    const icon = ensureIcon();
    icon.dataset.selectionText = text;
    currentSelectionText = text;
    updateIconPosition(rect);
  }

  function getSelectionDetails() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      return null;
    }

    if (isWithinWidget(selection.anchorNode) || isWithinWidget(selection.focusNode)) {
      return null;
    }

    const text = selection.toString().trim();
    if (!text) {
      return null;
    }

    let range;
    try {
      range = selection.getRangeAt(0).cloneRange();
    } catch (error) {
      return null;
    }

    let rect = range.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) {
      const rects = range.getClientRects();
      if (!rects.length) {
        return null;
      }
      rect = Array.from(rects).find((r) => r.width && r.height) || rects[0];
    }

    if (!rect || (!rect.width && !rect.height)) {
      return null;
    }

    return { text, rect };
  }

  let selectionCheckTimeout = null;

  function scheduleSelectionCheck(delay = 24) {
    if (selectionCheckTimeout) {
      clearTimeout(selectionCheckTimeout);
    }
    if (ctrlActive) {
      hideFloatingUI();
      return;
    }
    selectionCheckTimeout = setTimeout(() => {
      selectionCheckTimeout = null;
      const details = getSelectionDetails();
      if (!details) {
        hideFloatingUI();
        return;
      }
      showSelectionIcon(details.rect, details.text);
    }, delay);
  }

  function restoreCurrentInline() {
    if (!currentInline) {
      return;
    }

    const { placeholder, originalText, requestToken } = currentInline;

    if (requestToken) {
      requestToken.cancelled = true;
    }

    if (placeholder && placeholder.isConnected) {
      placeholder.replaceWith(document.createTextNode(originalText));
    }

    currentInline = null;
  }

  function createInlineReplacement(target) {
    if (!target?.node?.parentNode) {
      return null;
    }

    ensureStyles();

    const span = document.createElement('span');
    span.className = `${INLINE_CLASS} ${INLINE_LOADING_CLASS}`;
    span.setAttribute('data-ries-inline', 'true');
    span.textContent = '翻译中...';

    target.node.parentNode.replaceChild(span, target.node);

    return {
      placeholder: span,
      originalText: target.originalText,
      translationText: target.translationText,
      translationKey: target.normalized,
      requestToken: null,
      originalNode: target.node
    };
  }

  function applyInlineResult(inline, data) {
    if (!inline || !inline.placeholder || !inline.placeholder.isConnected) {
      return;
    }

    inline.placeholder.classList.remove(INLINE_LOADING_CLASS);

    const html = data?.translationHtml;
    const fallback = data?.translation ? escapeHtml(data.translation) : '';

    if (html) {
      inline.placeholder.innerHTML = html;
    } else if (fallback) {
      inline.placeholder.innerHTML = fallback;
    } else {
      inline.placeholder.textContent = 'No translation available';
    }

    inline.translationData = data;
  }

  function translateInlineTarget(inline) {
    if (!inline || !inline.placeholder || !inline.placeholder.isConnected) {
      return;
    }

    const cacheKey = inline.translationKey;

    inline.placeholder.classList.add(INLINE_LOADING_CLASS);
    inline.placeholder.textContent = '翻译中...';

    if (translationCache.has(cacheKey)) {
      applyInlineResult(inline, translationCache.get(cacheKey));
      return;
    }

    const token = { cancelled: false };
    inline.requestToken = token;

    requestSharedTranslation(inline.translationText, cacheKey)
      .then((data) => {
        if (token.cancelled) {
          return;
        }
        if (inline.requestToken !== token) {
          return;
        }
        applyInlineResult(inline, data);
      })
      .catch((error) => {
        if (token.cancelled) {
          return;
        }
        if (!inline.placeholder || !inline.placeholder.isConnected) {
          return;
        }
        inline.placeholder.classList.remove(INLINE_LOADING_CLASS);
        inline.placeholder.textContent = `翻译失败：${error.message || error}`;
      })
      .finally(() => {
        if (inline.requestToken === token) {
          inline.requestToken = null;
        }
      });
  }

  function processCtrlHover() {
    ctrlHoverRAF = null;
    if (!ctrlActive) {
      return;
    }

    const event = pendingCtrlEvent;
    pendingCtrlEvent = null;

    if (!event) {
      return;
    }

    const element = document.elementFromPoint(event.clientX, event.clientY);
    if (currentInline?.placeholder && element && currentInline.placeholder.contains(element)) {
      return;
    }

    const target = getInlineTargetFromPoint(event.clientX, event.clientY);

    if (!target) {
      restoreCurrentInline();
      return;
    }

    if (currentInline?.originalNode === target.node) {
      return;
    }

    restoreCurrentInline();

    const replacement = createInlineReplacement(target);
    if (!replacement) {
      return;
    }

    currentInline = replacement;
    translateInlineTarget(currentInline);
  }

  function handleCtrlMouseMove(event) {
    if (event.ctrlKey) {
      if (!ctrlActive) {
        setCtrlActive(true);
      }
    } else if (ctrlActive) {
      setCtrlActive(false);
      return;
    }

    if (!ctrlActive) {
      return;
    }

    pendingCtrlEvent = event;

    if (!ctrlHoverRAF) {
      ctrlHoverRAF = requestAnimationFrame(processCtrlHover);
    }
  }

  function setCtrlActive(state) {
    if (ctrlActive === state) {
      return;
    }
    ctrlActive = state;
    if (!ctrlActive) {
      pendingCtrlEvent = null;
      if (ctrlHoverRAF) {
        cancelAnimationFrame(ctrlHoverRAF);
        ctrlHoverRAF = null;
      }
      restoreCurrentInline();
    } else {
      hideFloatingUI();
    }
  }

  function handleCtrlKeyDown(event) {
    if (event.key === 'Control') {
      setCtrlActive(true);
    }
  }

  function handleCtrlKeyUp(event) {
    if (event.key === 'Control' || !event.ctrlKey) {
      setCtrlActive(false);
    }
  }

  function requestTranslation(text) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'RIES_TRANSLATE_TEXT', text }, (response) => {
        if (!response) {
          reject(new Error('No response from background script.'));
          return;
        }
        if (!response.ok) {
          reject(new Error(response.error || 'Translation failed.'));
          return;
        }
        resolve(response.data);
      });
    });
  }

  function requestSharedTranslation(text, key) {
    if (translationCache.has(key)) {
      return Promise.resolve(translationCache.get(key));
    }

    if (pendingTranslations.has(key)) {
      return pendingTranslations.get(key);
    }

    const promise = requestTranslation(text)
      .then((data) => {
        translationCache.set(key, data);
        pendingTranslations.delete(key);
        return data;
      })
      .catch((error) => {
        pendingTranslations.delete(key);
        throw error;
      });

    pendingTranslations.set(key, promise);
    return promise;
  }

  function buildTooltipHtml(data) {
    const translationHtml = data.translationHtml || (data.translation ? escapeHtml(data.translation) : '');
    const replacements = Array.isArray(data.replacements) ? data.replacements : [];
    if (!replacements.length) {
      return translationHtml;
    }

    const items = replacements
      .slice(0, 6)
      .map((item) => {
        const cn = escapeHtml(item.chinese ?? '');
        const en = escapeHtml(item.english ?? '');
        return `<span>${cn} &rarr; ${en}</span>`;
      })
      .join('');

    const more = replacements.length > 6 ? `<span>... ${replacements.length - 6} more</span>` : '';
    return `${translationHtml}<div class="ries-tooltip-terms">${items}${more}</div>`;
  }

  function handleIconMouseEnter() {
    if (!floatingIcon) {
      return;
    }

    const text = floatingIcon.dataset.selectionText;
    if (!text) {
      return;
    }

    const cacheKey = normalizeText(text);
    if (!cacheKey) {
      return;
    }

    iconHovered = true;
    showTooltip({ html: '', text: '翻译中...', loading: true });

    if (translationCache.has(cacheKey)) {
      const cached = translationCache.get(cacheKey);
      showTooltip({ html: buildTooltipHtml(cached) });
      return;
    }

    const requestToken = { text, cacheKey };
    activeRequest = requestToken;

    requestSharedTranslation(text, cacheKey)
      .then((data) => {
        if (activeRequest !== requestToken) {
          return;
        }
        if (currentSelectionText !== text) {
          return;
        }
        if (!iconHovered) {
          return;
        }
        showTooltip({ html: buildTooltipHtml(data) });
      })
      .catch((error) => {
        if (activeRequest !== requestToken) {
          return;
        }
        if (currentSelectionText !== text) {
          return;
        }
        if (!iconHovered) {
          return;
        }
        showTooltip({ text: `翻译失败：${error.message || error}` });
      })
      .finally(() => {
        if (activeRequest === requestToken) {
          activeRequest = null;
        }
      });
  }

  function handleIconMouseLeave() {
    iconHovered = false;
    hideTooltip();
  }

  function refreshFloatingPosition() {
    if (!floatingIcon) {
      return;
    }

    const details = getSelectionDetails();
    if (!details) {
      hideFloatingUI();
      return;
    }

    updateIconPosition(details.rect);
    if (floatingTooltip && floatingTooltip.style.display === 'block') {
      positionTooltip();
    }
  }

  function handleDocumentMouseDown(event) {
    const target = event.target;
    const insideIcon = floatingIcon && floatingIcon.contains(target);
    const insideTooltip = floatingTooltip && floatingTooltip.contains(target);

    if (floatingIcon && !insideIcon && !insideTooltip) {
      hideFloatingUI();
    }

    if (currentInline?.placeholder && !currentInline.placeholder.contains(target)) {
      restoreCurrentInline();
    }
  }

  document.addEventListener('selectionchange', () => scheduleSelectionCheck(80));
  document.addEventListener('mouseup', () => scheduleSelectionCheck(20));
  document.addEventListener('keyup', (event) => {
    if (event.key === 'Escape') {
      hideFloatingUI();
      const selection = window.getSelection();
      if (selection) {
        selection.removeAllRanges();
      }
      return;
    }
    scheduleSelectionCheck(40);
  });
  document.addEventListener('mousedown', handleDocumentMouseDown, true);
  document.addEventListener('mousemove', handleCtrlMouseMove, true);
  document.addEventListener('keydown', handleCtrlKeyDown, true);
  document.addEventListener('keyup', handleCtrlKeyUp, true);
  window.addEventListener('scroll', () => refreshFloatingPosition(), true);
  window.addEventListener('resize', () => refreshFloatingPosition());
  window.addEventListener('blur', () => setCtrlActive(false));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      setCtrlActive(false);
    }
  });

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
