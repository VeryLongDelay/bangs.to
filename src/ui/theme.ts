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
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function updateThemeToggles(theme: Theme) {
  for (const toggle of document.querySelectorAll<HTMLElement>(
    "[data-theme-toggle]"
  )) {
    toggle.dataset.theme = theme;
    toggle.setAttribute("aria-checked", String(theme === "dark"));

    const input = toggle.querySelector<HTMLInputElement>(
      "[data-theme-toggle-input]"
    );
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
  for (const input of document.querySelectorAll<HTMLInputElement>(
    "[data-theme-toggle-input]"
  )) {
    input.addEventListener("change", () => {
      applyTheme(input.checked ? "dark" : "light");
    });
  }
}

applyTheme(readStoredTheme() ?? getTheme());
initThemeToggle();
