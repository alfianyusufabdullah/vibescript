import React from 'react';
import { createRoot } from 'react-dom/client';
import App from '../sidepanel/App';
import cssText from '../index.css?inline';

const ROOT_ID = 'vibescript-root';

export function mountApp(): void {
  if (document.getElementById(ROOT_ID)) return;

  const host = document.createElement('div');
  host.id = ROOT_ID;
  document.body.appendChild(host);

  const shadowRoot = host.attachShadow({ mode: 'open' });

  const styleEl = document.createElement('style');
  styleEl.textContent = cssText;
  shadowRoot.appendChild(styleEl);

  const reactContainer = document.createElement('div');
  shadowRoot.appendChild(reactContainer);

  // Prevent keyboard events from bubbling to the GAS IDE host page,
  // which intercepts characters like "/" as editor shortcuts.
  const stopKey = (e: Event) => e.stopPropagation();
  reactContainer.addEventListener('keydown', stopKey);
  reactContainer.addEventListener('keyup', stopKey);

  const root = createRoot(reactContainer);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

export function injectGlobalStyles(): void {
  const linkId = 'vibescript-google-fonts';
  if (!document.getElementById(linkId)) {
    const preconnect1 = document.createElement('link');
    preconnect1.rel = 'preconnect';
    preconnect1.href = 'https://fonts.googleapis.com';
    document.head.appendChild(preconnect1);

    const preconnect2 = document.createElement('link');
    preconnect2.rel = 'preconnect';
    preconnect2.href = 'https://fonts.gstatic.com';
    preconnect2.crossOrigin = 'anonymous';
    document.head.appendChild(preconnect2);

    const fontLink = document.createElement('link');
    fontLink.id = linkId;
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap';
    document.head.appendChild(fontLink);
  }

  const globalStyleElId = 'vibescript-global-styles';
  if (!document.getElementById(globalStyleElId)) {
    const style = document.createElement('style');
    style.id = globalStyleElId;
    style.textContent = `
      .vibescript-ide-shrunk {
        right: 380px !important;
        width: calc(100% - 380px) !important;
      }
      .vibescript-ide-transition {
        transition: right 0.3s cubic-bezier(0.16, 1, 0.3, 1), width 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
      }
      body.vibescript-no-transition,
      body.vibescript-no-transition *,
      .vibescript-no-transition,
      .vibescript-no-transition * {
        transition: none !important;
      }
    `;
    document.head.appendChild(style);
  }
}
