import { DB_VERSION } from './constants';

const DB_NAME = 'bangs-to';
const LEGACY_DB_NAME = ['flash', 'bang'].join('');
const SETTINGS_STORE = 'settings';
const CUSTOM_BANGS_STORE = 'custom-bangs';

let dbPromise: Promise<IDBDatabase> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = openAndMigrateDB();
  }
  return dbPromise;
}

export function resetDB(): void {
  dbPromise = null;
}

export function idbWrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((ok, err) => {
    req.onsuccess = () => ok(req.result);
    req.onerror = () => err(req.error);
  });
}

async function openAndMigrateDB(): Promise<IDBDatabase> {
  const db = await openNamedDB(DB_NAME);
  if (!(await dbHasData(db))) {
    await migrateLegacyDB(db);
  }
  return db;
}

function openNamedDB(name: string): Promise<IDBDatabase> {
  return new Promise((ok, err) => {
    const r = indexedDB.open(name, DB_VERSION);
    r.onupgradeneeded = event => {
      const db = r.result;
      const oldVersion = event.oldVersion;
      if (oldVersion < 1) {
        db.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
        db.createObjectStore(CUSTOM_BANGS_STORE, { keyPath: 'trigger' });
      }
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => err(r.error);
  });
}

async function dbHasData(db: IDBDatabase): Promise<boolean> {
  const tx = db.transaction([SETTINGS_STORE, CUSTOM_BANGS_STORE], 'readonly');
  const settingsStore = tx.objectStore(SETTINGS_STORE);
  const customBangsStore = tx.objectStore(CUSTOM_BANGS_STORE);
  const [settingsCount, customBangsCount] = await Promise.all([
    idbWrap(settingsStore.count()),
    idbWrap(customBangsStore.count())
  ]);
  return settingsCount > 0 || customBangsCount > 0;
}

async function migrateLegacyDB(db: IDBDatabase): Promise<void> {
  let legacyDB: IDBDatabase | null = null;
  try {
    legacyDB = await openNamedDB(LEGACY_DB_NAME);
    if (!(await dbHasData(legacyDB))) {
      legacyDB.close();
      return;
    }

    const tx = legacyDB.transaction([SETTINGS_STORE, CUSTOM_BANGS_STORE], 'readonly');
    const settingsStore = tx.objectStore(SETTINGS_STORE);
    const customBangsStore = tx.objectStore(CUSTOM_BANGS_STORE);
    const [settings, customBangs] = await Promise.all([
      idbWrap(settingsStore.getAll()),
      idbWrap(customBangsStore.getAll())
    ]);

    const writeTx = db.transaction([SETTINGS_STORE, CUSTOM_BANGS_STORE], 'readwrite');
    for (const entry of settings) {
      writeTx.objectStore(SETTINGS_STORE).put(entry);
    }
    for (const entry of customBangs) {
      writeTx.objectStore(CUSTOM_BANGS_STORE).put(entry);
    }
    await transactionDone(writeTx);
    legacyDB.close();
  } catch {
    legacyDB?.close();
  }
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((ok, err) => {
    tx.oncomplete = () => ok();
    tx.onerror = () => err(tx.error);
    tx.onabort = () => err(tx.error);
  });
}
