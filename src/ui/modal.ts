import { $ } from './dom';

export function setupModal(onFirstOpen: () => void) {
  const SETTINGS_HASH = '#settings';
  const modal = $('#settings-modal');
  const gearBtn = $('#gear-btn');
  const closeBtn = $('#modal-close');
  const card = modal.querySelector('[role="dialog"]') as HTMLElement;

  let initialized = false;
  let isOpen = false;

  function openModal() {
    if (isOpen) {
      closeBtn.focus();
      return;
    }
    if (!initialized) {
      initialized = true;
      onFirstOpen();
    }
    isOpen = true;
    modal.classList.replace('opacity-0', 'opacity-100');
    modal.classList.replace('invisible', 'visible');
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    card.classList.replace('translate-y-2', 'translate-y-0');
    document.body.style.overflow = 'hidden';
    closeBtn.focus();
  }

  function closeModal({ restoreFocus = true } = {}) {
    if (!isOpen) {
      return;
    }
    isOpen = false;
    modal.classList.replace('opacity-100', 'opacity-0');
    modal.classList.replace('visible', 'invisible');
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    card.classList.replace('translate-y-0', 'translate-y-2');
    document.body.style.overflow = '';
    if (location.hash === SETTINGS_HASH) {
      history.replaceState(null, '', `${location.pathname}${location.search}`);
    }
    if (restoreFocus) {
      gearBtn.focus();
    }
  }

  function syncFromHash() {
    if (location.hash === SETTINGS_HASH) {
      openModal();
    } else {
      closeModal({ restoreFocus: false });
    }
  }

  gearBtn.addEventListener('click', () => {
    if (location.hash === SETTINGS_HASH) {
      openModal();
    }
  });
  closeBtn.addEventListener('click', () => closeModal());

  modal.addEventListener('click', e => {
    if (e.target === modal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && modal.classList.contains('open')) {
      closeModal();
    }
  });

  modal.addEventListener('keydown', e => {
    if (e.key !== 'Tab') {
      return;
    }
    const focusable = card.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

  window.addEventListener('hashchange', syncFromHash);

  return { openModal, syncFromHash };
}
