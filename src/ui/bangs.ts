import { setupBangBrowser } from "./bang-browser";
import { setSuggestCookie } from "./cookie";
import { setupCustomBangs } from "./custom-bangs";
import { DB, readCustomBangs } from "./db";

const db = new DB();

async function init() {
  await setupBangBrowser({
    countSelector: "#page-bang-count",
    inputSelector: "#page-bang-search",
    resultsSelector: "#page-bang-results",
    resultLimit: 60,
  });

  const [provider, trigger, url, custom] = await Promise.all([
    db.getSetting("suggest-provider").then((value) => value || "default"),
    db.getSetting("default-bang").then((value) => value || "ddg"),
    db.getSetting("suggest-url").then((value) => value || ""),
    readCustomBangs(db),
  ]);

  setSuggestCookie(provider, trigger, url, custom);

  setupCustomBangs(db, {
    formSelector: "#page-add-bang-form",
    listSelector: "#page-custom-list",
    onChange: (nextCustom) => {
      setSuggestCookie(provider, trigger, url, nextCustom);
    },
  });
}

init();
