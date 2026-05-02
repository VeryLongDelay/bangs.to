const STORAGE_KEY = "theme";
const THEME_COLORS = {
  dark: "#08111d",
  light: "#f4f8fc",
} as const;

type Theme = keyof typeof THEME_COLORS;

function readStoredTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "dark" || value === "light" ? value : null;
  } catch {
    return null;
  }
}

function getTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function updateThemeToggles(theme: Theme) {
  for (const toggle of Array.from(
    document.querySelectorAll<HTMLElement>("[data-theme-toggle]")
  )) {
    toggle.dataset.theme = theme;
    toggle.setAttribute("aria-checked", String(theme === "dark"));

    const input = toggle.querySelector(
      "[data-theme-toggle-input]"
    ) as HTMLInputElement | null;
    if (input) {
      input.checked = theme === "dark";
    }
  }
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", THEME_COLORS[theme]);

  updateThemeToggles(theme);

  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // ignore storage failures
  }
}

function initThemeToggle() {
  for (const input of Array.from(
    document.querySelectorAll<HTMLInputElement>("[data-theme-toggle-input]")
  )) {
    input.addEventListener("change", () => {
      applyTheme(input.checked ? "dark" : "light");
    });
  }
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

function updateShortcutModifierLabel() {
  const modifierChip = document.querySelector<HTMLElement>(
    "[data-shortcut-modifier]"
  );
  if (!modifierChip) {
    return;
  }

  const platform =
    navigator.userAgentData?.platform || navigator.platform || "";
  const isMac = /mac|iphone|ipad|ipod/i.test(platform);
  modifierChip.textContent = isMac ? "⌘" : "Ctrl";
}

function setShortcutChipActive(
  name: "modifier" | "k" | "slash",
  active: boolean
) {
  const chip = document.querySelector<HTMLElement>(
    `[data-shortcut-chip="${name}"]`
  );
  if (!chip) {
    return;
  }

  chip.classList.toggle("bg-white/88", !active);
  chip.classList.toggle("text-text-muted", !active);
  chip.classList.toggle("border-white/70", !active);
  chip.classList.toggle("bg-primary-500", active);
  chip.classList.toggle("text-white", active);
  chip.classList.toggle("border-primary-300", active);
}

function initSearchShortcut() {
  const resetShortcutChips = () => {
    setShortcutChipActive("slash", false);
    setShortcutChipActive("modifier", false);
    setShortcutChipActive("k", false);
  };

  updateShortcutModifierLabel();

  document.addEventListener("keydown", (event) => {
    setShortcutChipActive(
      "slash",
      !(event.metaKey || event.ctrlKey || event.altKey) && event.key === "/"
    );
    setShortcutChipActive("modifier", event.metaKey || event.ctrlKey);
    setShortcutChipActive("k", event.key.toLowerCase() === "k");

    const modK =
      (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";
    const slash =
      !(event.metaKey || event.ctrlKey || event.altKey) && event.key === "/";

    if (!(modK || slash)) {
      return;
    }

    if (isEditableTarget(event.target)) {
      return;
    }

    const search = document.querySelector<HTMLInputElement>("#try-query");
    if (!search) {
      return;
    }

    event.preventDefault();
    search.focus();
    search.select();
    window.setTimeout(resetShortcutChips, 120);
  });

  document.addEventListener("keyup", (event) => {
    if (event.key === "/") {
      setShortcutChipActive("slash", false);
    }

    if (event.key.toLowerCase() === "k") {
      setShortcutChipActive("k", false);
    }

    if (!(event.metaKey || event.ctrlKey)) {
      setShortcutChipActive("modifier", false);
    }
  });

  window.addEventListener("blur", resetShortcutChips);
}

applyTheme(readStoredTheme() ?? getTheme());
initThemeToggle();
initSearchShortcut();
