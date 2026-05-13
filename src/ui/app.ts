import { SITE_TITLE } from '../config/site';
import { flashAnim } from './animations';
import { setSuggestCookie } from './cookie';
import { DB, readCustomBangs } from './db';
import { $ } from './dom';
import { initLiquidMetal } from './liquid-metal';
import { setupModal } from './modal';
import { initSettings } from './settings';

const db = new DB();
const CONSOLE_ICON_ASCII = String.raw`
##########################
##########################
##########################
###############..#   +####
############.....#   -####
#########.......##   #####
######- ........##   #####
#####    .......##   #####
########   .....###-######
########   .#...##########
#######  #####..#   ######
##########################
##########################
##########################
`;

function navigateSearch(query: string) {
  const target = `/?q=${encodeURIComponent(query)}`;

  if (!('serviceWorker' in navigator)) {
    location.assign(target);
    return;
  }

  const sendRedirectRequest = () => {
    const controller = navigator.serviceWorker.controller;
    if (!controller) {
      return false;
    }

    const handleMessage = (event: MessageEvent<{ url?: string }>) => {
      if (event.data?.url) {
        location.replace(event.data.url);
        return;
      }
      location.assign(target);
    };

    navigator.serviceWorker.addEventListener('message', handleMessage, { once: true });
    controller.postMessage({ type: 'redirect', query });
    return true;
  };

  if (sendRedirectRequest()) {
    return;
  }

  let fallbackTimer = window.setTimeout(() => {
    fallbackTimer = 0;
    location.assign(target);
  }, 1600);

  navigator.serviceWorker.addEventListener(
    'controllerchange',
    () => {
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = 0;
      }

      if (!sendRedirectRequest()) {
        location.assign(target);
      }
    },
    { once: true }
  );

  navigator.serviceWorker
    .register('/sw.js')
    .then(registration => {
      registration.active?.postMessage({ type: 'claim' });
    })
    .catch(() => {
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
      }
      location.assign(target);
    });
}

function initSearchForm() {
  const form = document.querySelector<HTMLFormElement>('#try-search-form');
  const input = form?.querySelector<HTMLInputElement>('input[name="q"]');

  if (!(form && input)) {
    return;
  }

  input.addEventListener('keydown', event => {
    if (event.key !== 'Escape') {
      return;
    }

    input.blur();
  });

  form.addEventListener('submit', event => {
    const query = input.value.trim();
    if (!query) {
      return;
    }

    event.preventDefault();
    navigateSearch(query);
  });
}

function initCopyTargets() {
  const copyTargets = document.querySelectorAll<HTMLElement>('[data-copy-text]');

  for (const target of copyTargets) {
    const status = target.querySelector<HTMLElement>('[data-copy-status]');
    const defaultStatus = status?.textContent ?? '';

    const triggers = target.querySelectorAll<HTMLElement>('[data-copy-trigger]');

    for (const trigger of triggers) {
      trigger.addEventListener('click', async (event: MouseEvent) => {
        event.preventDefault();

        const copyText = target.dataset.copyText;
        if (!copyText) {
          return;
        }

        await navigator.clipboard.writeText(copyText);
        flashAnim(target);

        if (!status) {
          return;
        }

        status.textContent = 'Copied';
        window.setTimeout(() => {
          status.textContent = defaultStatus;
        }, 1500);
      });
    }
  }
}

function initConsoleEasterEgg() {
  const appWindow = window as typeof window & { __bangsConsoleArtShown?: boolean };

  if (appWindow.__bangsConsoleArtShown) {
    return;
  }

  appWindow.__bangsConsoleArtShown = true;

  console.log(
    `%c${CONSOLE_ICON_ASCII}%c\nbangs.to%c\nThanks for checking out bangs.to!`,
    'color: #bfdbfe; font: 13px/1.05 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;',
    'color: #f8fafc; font: 700 16px/1.3 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;',
    'color: #94a3b8; font: 12px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;'
  );
}

async function syncSuggestCookie() {
  const [provider, trigger, url, custom] = await Promise.all([
    db.getSetting('suggest-provider').then(v => v || 'default'),
    db.getSetting('default-bang').then(v => v || 'ddg'),
    db.getSetting('suggest-url').then(v => v || ''),
    readCustomBangs(db)
  ]);

  setSuggestCookie(provider, trigger, url, custom);
}

function init() {
  initConsoleEasterEgg();
  syncSuggestCookie();
  initSearchForm();
  initCopyTargets();

  $<HTMLInputElement>('#setup-url').value = `${location.origin}?q=%s`;

  const wordmark = document.querySelector('.wordmark') as HTMLElement | null;
  const metalCanvas = document.querySelector('#metal-canvas') as HTMLCanvasElement | null;
  const metal = wordmark && metalCanvas ? initLiquidMetal(metalCanvas, SITE_TITLE) : null;
  wordmark?.classList.add('has-shader');

  $('#copy-btn').addEventListener('click', async () => {
    await navigator.clipboard.writeText($<HTMLInputElement>('#setup-url').value);
    flashAnim($<HTMLInputElement>('#setup-url'));
    metal?.flash();
    $('#copy-btn').textContent = 'Copied!';
    setTimeout(() => ($('#copy-btn').textContent = 'Copy'), 1500);
  });

  const { openModal, syncFromHash } = setupModal(() => initSettings(db));

  if (location.pathname === '/settings') {
    history.replaceState(null, '', `${location.origin}/#settings`);
    syncFromHash();
    return;
  }

  if (location.hash === '#settings') {
    openModal();
  }
}

init();
