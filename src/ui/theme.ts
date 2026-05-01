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

function initSearchShortcut() {
  document.addEventListener("keydown", (event) => {
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
  });
}

applyTheme(readStoredTheme() ?? getTheme());
initThemeToggle();
initSearchShortcut();
