import { $, el } from './dom';

interface BangMeta {
  d: string;
  s: string;
}

interface BangBrowserOptions {
  countSelector?: string;
  emptyText?: string;
  initialLimit?: number;
  inputSelector: string;
  resultsSelector: string;
  resultLimit?: number;
}

function renderBangRow(trigger: string, bang: BangMeta) {
  const row = el(
    'div',
    'grid gap-3 rounded-[18px] bg-bg-soft px-3 py-3 sm:grid-cols-[minmax(0,120px)_minmax(0,1fr)_auto] sm:items-center'
  );
  row.append(
    el(
      'code',
      'w-fit rounded-full bg-bg-active px-2.5 py-1 text-xs font-mono text-text',
      `!${trigger}`
    ),
    el('span', 'min-w-0 text-sm font-600 text-text', bang.s),
    el('span', 'text-xs text-text-secondary sm:text-right', bang.d || 'Custom destination')
  );
  return row;
}

export async function setupBangBrowser({
  countSelector,
  emptyText = 'No matches',
  initialLimit = 24,
  inputSelector,
  resultsSelector,
  resultLimit = 40
}: BangBrowserOptions) {
  const input = $<HTMLInputElement>(inputSelector);
  const results = $(resultsSelector);
  const count = countSelector ? $<HTMLElement>(countSelector) : null;

  const mod = await import('../generated/bangs-meta.js');
  const full: Record<string, BangMeta> = mod.BANGS;
  const entries = Object.entries(full).sort((a, b) => a[0].localeCompare(b[0]));

  if (count) {
    count.textContent = `${entries.length.toLocaleString()} bangs available`;
  }

  function render(query: string) {
    const normalized = query.trim().toLowerCase();
    const hits =
      normalized.length === 0
        ? entries.slice(0, initialLimit)
        : entries
            .filter(
              ([trigger, bang]) =>
                trigger.includes(normalized) ||
                bang.s.toLowerCase().includes(normalized) ||
                bang.d.includes(normalized)
            )
            .sort((a, b) => {
              const aStarts = a[0].startsWith(normalized) ? 0 : 1;
              const bStarts = b[0].startsWith(normalized) ? 0 : 1;
              return aStarts - bStarts || a[0].length - b[0].length;
            })
            .slice(0, resultLimit);

    if (hits.length === 0) {
      results.replaceChildren(el('div', 'py-4 text-center text-sm text-text-secondary', emptyText));
      return;
    }

    results.replaceChildren(...hits.map(([trigger, bang]) => renderBangRow(trigger, bang)));
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  input.addEventListener('input', event => {
    if (timer) {
      clearTimeout(timer);
    }
    const nextQuery = (event.target as HTMLInputElement).value;
    timer = setTimeout(() => render(nextQuery), 120);
  });

  render(input.value);
}
