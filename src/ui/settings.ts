import { flashAnim, shakeAnim } from "./animations";
import { setupBangBrowser } from "./bang-browser";
import { setSuggestCookie } from "./cookie";
import { setupCustomBangs } from "./custom-bangs";
import { type DB, readCustomBangs } from "./db";
import { $ } from "./dom";
import { notifySW } from "./sw-bridge";

export async function initSettings(db: DB) {
  const defaultInput = $<HTMLInputElement>("#default-bang");
  const suggestSelect = $<HTMLSelectElement>("#suggest-provider");
  const suggestUrlInput = $<HTMLInputElement>("#suggest-url");
  const luckySelect = $<HTMLSelectElement>("#lucky-provider");
  const luckyUrlInput = $<HTMLInputElement>("#lucky-url");

  const [
    defaultBang,
    savedProvider,
    savedUrl,
    savedLucky,
    savedLuckyUrl,
    initialCustom,
  ] = await Promise.all([
    db.getSetting("default-bang").then((v) => v || "ddg"),
    db.getSetting("suggest-provider").then((v) => v || "default"),
    db.getSetting("suggest-url").then((v) => v || ""),
    db.getSetting("lucky-provider").then((v) => v || "default"),
    db.getSetting("lucky-url").then((v) => v || ""),
    readCustomBangs(db),
  ]);
  let custom = initialCustom;

  luckySelect.value = savedLucky;
  if (savedLucky === "custom") {
    luckyUrlInput.classList.remove("hidden");
  }
  if (savedLuckyUrl) {
    luckyUrlInput.value = savedLuckyUrl;
  }

  defaultInput.value = defaultBang;
  suggestSelect.value = savedProvider;
  if (savedProvider === "custom") {
    suggestUrlInput.classList.remove("hidden");
  }
  if (savedUrl) {
    suggestUrlInput.value = savedUrl;
  }

  setSuggestCookie(savedProvider, defaultBang, savedUrl, custom);

  const mod = await import("../generated/bangs-meta.js");
  const full: Record<string, { s: string; d: string }> = mod.BANGS;
  $("#bang-status").textContent = full[defaultBang]?.s || "Unknown";
  await setupBangBrowser({
    countSelector: "#bang-count",
    initialLimit: 0,
    inputSelector: "#bang-search",
    resultsSelector: "#bang-results",
    resultLimit: 20,
  });

  defaultInput.addEventListener("change", async () => {
    const val = defaultInput.value.replace(/^!+/, "").toLowerCase().trim();
    if (full[val]) {
      await db.setSetting("default-bang", val);
      notifySW("invalidate");
      setSuggestCookie(
        suggestSelect.value,
        val,
        suggestUrlInput.value.trim(),
        custom
      );
      flashAnim(defaultInput);
      $("#bang-status").textContent = full[val].s;
      $("#bang-status").className = "text-sm text-success";
    } else {
      shakeAnim(defaultInput);
      $("#bang-status").textContent = "Unknown bang";
      $("#bang-status").className = "text-sm text-danger";
    }
  });

  suggestSelect.addEventListener("change", async () => {
    await db.setSetting("suggest-provider", suggestSelect.value);
    notifySW("invalidate");
    setSuggestCookie(
      suggestSelect.value,
      defaultInput.value,
      suggestUrlInput.value.trim(),
      custom
    );
    if (suggestSelect.value === "custom") {
      suggestUrlInput.classList.remove("hidden");
    } else {
      suggestUrlInput.classList.add("hidden");
    }
  });

  suggestUrlInput.addEventListener("change", async () => {
    const url = suggestUrlInput.value.trim();
    await db.setSetting("suggest-url", url);
    notifySW("invalidate");
    setSuggestCookie(suggestSelect.value, defaultInput.value, url, custom);
  });

  luckySelect.addEventListener("change", async () => {
    await db.setSetting("lucky-provider", luckySelect.value);
    notifySW("invalidate");
    if (luckySelect.value === "custom") {
      luckyUrlInput.classList.remove("hidden");
    } else {
      luckyUrlInput.classList.add("hidden");
    }
  });

  luckyUrlInput.addEventListener("change", async () => {
    await db.setSetting("lucky-url", luckyUrlInput.value.trim());
    notifySW("invalidate");
  });

  setupCustomBangs(db, {
    onChange: (nextCustom) => {
      custom = nextCustom;
      setSuggestCookie(
        suggestSelect.value,
        defaultInput.value,
        suggestUrlInput.value.trim(),
        custom
      );
    },
  });

  $("#export-btn").addEventListener("click", async () => {
    const data = await db.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `bangs-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $<HTMLInputElement>("#import-file").addEventListener("change", async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }
    try {
      const data = JSON.parse(await file.text());
      await db.importAll(data);
      notifySW("invalidate");
      $("#import-status").textContent = "Imported successfully";
      $("#import-status").className = "text-sm mt-2 block text-success";
      setTimeout(() => location.reload(), 1000);
    } catch {
      $("#import-status").textContent = "Invalid file";
      $("#import-status").className = "text-sm mt-2 block text-danger";
    }
  });
}
