import {
  type BangUsageEntry,
  deserializeFrecencySnapshot,
  type WeeklyUsageBuckets
} from '../sw/frecency';
import { DB } from './db';
import { $, el } from './dom';

interface BangMeta {
  d: string;
  s: string;
}

interface DisplayEntry {
  count: number;
  domain: string;
  lastUsedAt: number;
  name: string;
  queries: Array<{ count: number; lastUsedAt: number; query: string }>;
  score: number;
  trigger: string;
}

interface StatsModel {
  entries: DisplayEntry[];
  weeklyBuckets: WeeklyUsageBuckets;
}

const db = new DB();
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatRelativeTime(timestamp: number): string {
  const deltaMs = Date.now() - timestamp;
  if (deltaMs < 60_000) {
    return 'Just now';
  }

  const deltaMinutes = Math.round(deltaMs / 60_000);
  if (deltaMinutes < 60) {
    return `${deltaMinutes}m ago`;
  }

  const deltaHours = Math.round(deltaMinutes / 60);
  if (deltaHours < 48) {
    return `${deltaHours}h ago`;
  }

  const deltaDays = Math.round(deltaHours / 24);
  if (deltaDays < 30) {
    return `${deltaDays}d ago`;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(timestamp);
}

function usageQueries(
  entry: BangUsageEntry
): Array<{ count: number; lastUsedAt: number; query: string }> {
  return Object.entries(entry.queries)
    .map(([query, value]) => ({ query, count: value.count, lastUsedAt: value.lastUsedAt }))
    .sort(
      (a, b) => b.count - a.count || b.lastUsedAt - a.lastUsedAt || a.query.localeCompare(b.query)
    );
}

function summaryCard(label: string, value: string, detail: string, accent: string): HTMLElement {
  const card = el(
    'article',
    `card overflow-hidden border border-white/70 bg-linear-to-br ${accent} p-5 sm:p-6`
  );
  card.innerHTML = `
    <p class="text-xs font-700 uppercase tracking-[0.24em] text-text-secondary">${escapeHtml(label)}</p>
    <p class="mt-3 font-display text-[2.2rem] font-800 leading-none tracking-[-0.05em] text-text">${escapeHtml(value)}</p>
    <p class="mt-3 text-sm leading-6 text-text-secondary">${escapeHtml(detail)}</p>
  `;
  return card;
}

function formatPercent(numerator: number, denominator: number): string {
  if (denominator <= 0) {
    return '0%';
  }
  return `${Math.max(1, Math.round((numerator / denominator) * 100))}%`;
}

function buildLeaderboard(entries: DisplayEntry[]) {
  const container = $('#stats-top-list');
  container.replaceChildren();
  const maxScore = entries[0]?.score || 1;

  for (const [index, entry] of entries.slice(0, 10).entries()) {
    const article = el(
      'article',
      'rounded-[24px] border border-white/70 bg-bg-soft p-4 transition-colors duration-200 hover:border-primary-200 dark:border-white/10'
    );
    const width = Math.max(12, Math.round((entry.score / maxScore) * 100));
    article.innerHTML = `
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <span class="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-white/90 px-2 text-xs font-700 text-primary-700 dark:bg-white/10 dark:text-primary-200">
              ${index + 1}
            </span>
            <code class="text-sm font-700 text-text">!${escapeHtml(entry.trigger)}</code>
            <span class="truncate text-sm text-text-secondary">${escapeHtml(entry.name)}</span>
          </div>
          <p class="mt-2 truncate text-xs uppercase tracking-[0.18em] text-text-muted">${escapeHtml(entry.domain || 'Custom bang')}</p>
        </div>
        <div class="shrink-0 text-right">
          <p class="text-sm font-700 text-text">${entry.score.toLocaleString()}</p>
          <p class="text-xs text-text-secondary">${entry.count.toLocaleString()} uses</p>
        </div>
      </div>
      <div class="mt-4 h-2 overflow-hidden rounded-full bg-white/80 dark:bg-white/8">
        <div class="h-full rounded-full bg-linear-to-r from-primary-500 via-sky-400 to-cyan-300" style="width:${width}%"></div>
      </div>
      <div class="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-text-secondary">
        <span>Last used ${formatRelativeTime(entry.lastUsedAt)}</span>
        <span>${entry.queries[0] ? `Typical: ${escapeHtml(entry.queries[0].query)}` : 'No stored query sample yet'}</span>
      </div>
    `;
    container.append(article);
  }
}

function buildRecent(entries: DisplayEntry[]) {
  const container = $('#stats-recent-list');
  container.replaceChildren();

  for (const entry of [...entries].sort((a, b) => b.lastUsedAt - a.lastUsedAt).slice(0, 8)) {
    const article = el(
      'article',
      'rounded-[22px] border border-white/70 bg-bg-soft px-4 py-3 dark:border-white/10'
    );
    article.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-sm font-700 text-text"><code>!${escapeHtml(entry.trigger)}</code> <span class="font-500 text-text-secondary">${escapeHtml(entry.name)}</span></p>
          <p class="mt-1 truncate text-xs uppercase tracking-[0.16em] text-text-muted">${escapeHtml(entry.domain || 'Custom bang')}</p>
        </div>
        <p class="shrink-0 text-xs font-700 uppercase tracking-[0.18em] text-primary-700">
          ${formatRelativeTime(entry.lastUsedAt)}
        </p>
      </div>
    `;
    container.append(article);
  }
}

function buildFrequency(entries: DisplayEntry[]) {
  const container = $('#stats-frequency-list');
  container.replaceChildren();

  const ranked = [...entries]
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.score - a.score ||
        b.lastUsedAt - a.lastUsedAt ||
        a.trigger.localeCompare(b.trigger)
    )
    .slice(0, 8);
  const maxCount = ranked[0]?.count || 1;
  const totalUses = entries.reduce((sum, entry) => sum + entry.count, 0);

  for (const entry of ranked) {
    const article = el(
      'article',
      'rounded-[22px] border border-white/70 bg-bg-soft px-4 py-3 dark:border-white/10'
    );
    const width = Math.max(10, Math.round((entry.count / maxCount) * 100));
    article.innerHTML = `
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="text-sm font-700 text-text"><code>!${escapeHtml(entry.trigger)}</code> <span class="font-500 text-text-secondary">${escapeHtml(entry.name)}</span></p>
          <p class="mt-1 truncate text-xs uppercase tracking-[0.16em] text-text-muted">${formatPercent(entry.count, totalUses)} of all tracked runs</p>
        </div>
        <div class="shrink-0 text-right">
          <p class="text-sm font-700 text-text">${entry.count.toLocaleString()}</p>
          <p class="text-xs text-text-secondary">total uses</p>
        </div>
      </div>
      <div class="mt-3 h-2 overflow-hidden rounded-full bg-white/80 dark:bg-white/8">
        <div class="h-full rounded-full bg-linear-to-r from-amber-400 via-orange-400 to-rose-400" style="width:${width}%"></div>
      </div>
    `;
    container.append(article);
  }
}

function buildQueryGroups(entries: DisplayEntry[]) {
  const container = $('#stats-query-groups');
  container.replaceChildren();

  const withQueries = entries.filter(entry => entry.queries.length > 0).slice(0, 10);
  if (withQueries.length === 0) {
    const empty = el(
      'div',
      'rounded-[22px] border border-dashed border-white/70 bg-bg-soft px-4 py-6 text-sm text-text-secondary dark:border-white/12',
      'No stored query samples yet. Full bang searches with terms will appear here.'
    );
    container.append(empty);
    return;
  }

  for (const entry of withQueries) {
    const article = el(
      'article',
      'rounded-[24px] border border-white/70 bg-bg-soft p-4 dark:border-white/10 dark:bg-slate-950/55'
    );
    const chips = entry.queries
      .slice(0, 4)
      .map(
        query => `
          <span class="rounded-full border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-600 text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.06)] dark:border-white/12 dark:bg-[rgba(15,23,42,0.78)] dark:text-slate-100 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
            ${escapeHtml(query.query)}
          </span>
        `
      )
      .join('');
    article.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="text-sm font-700 text-text"><code>!${escapeHtml(entry.trigger)}</code> <span class="font-500 text-text-secondary">${escapeHtml(entry.name)}</span></p>
          <p class="mt-1 text-xs uppercase tracking-[0.16em] text-text-muted">${entry.queries.length} saved pattern${entry.queries.length === 1 ? '' : 's'}</p>
        </div>
        <p class="text-xs text-text-secondary">Last used ${formatRelativeTime(entry.lastUsedAt)}</p>
      </div>
      <div class="mt-4 flex flex-wrap gap-2">${chips}</div>
    `;
    container.append(article);
  }
}

function formatBucketHour(hour: number): string {
  const nextHour = (hour + 1) % 24;
  const format = (value: number) =>
    new Intl.DateTimeFormat(undefined, {
      hour: 'numeric'
    }).format(new Date(2024, 0, 1, value));
  return `${format(hour)} to ${format(nextHour)}`;
}

function buildHeatmap(weeklyBuckets: WeeklyUsageBuckets) {
  const container = $('#stats-heatmap-grid');
  const summary = $('#stats-heatmap-summary');
  container.replaceChildren();

  const maxValue = weeklyBuckets.reduce((max, value) => Math.max(max, value), 0);
  if (maxValue === 0) {
    summary.textContent = 'No timed activity yet. Your weekly rhythm appears after a few searches.';
    return;
  }

  let peakIndex = 0;
  for (let i = 1; i < weeklyBuckets.length; i++) {
    if (weeklyBuckets[i] > weeklyBuckets[peakIndex]) {
      peakIndex = i;
    }
  }

  const peakDay = DAY_LABELS[Math.floor(peakIndex / 24)] || 'Sun';
  const peakHour = peakIndex % 24;
  const totalTracked = weeklyBuckets.reduce((sum, value) => sum + value, 0);
  summary.textContent = `${peakDay} ${formatBucketHour(peakHour)} is your busiest recurring window, with ${weeklyBuckets[peakIndex].toLocaleString()} searches tracked there out of ${totalTracked.toLocaleString()} total timed runs.`;

  for (const [dayIndex, dayLabel] of DAY_LABELS.entries()) {
    const row = el('div', 'grid min-w-[720px] flex-1 gap-1.5');
    row.setAttribute('role', 'row');
    row.style.gridTemplateColumns = 'repeat(24, minmax(0, 1fr))';

    const rowWrapper = el('div', 'flex items-center gap-2 sm:gap-3');
    const rowLabel = el(
      'div',
      'w-11 shrink-0 text-right text-[11px] font-700 uppercase tracking-[0.18em] text-text-muted',
      dayLabel
    );
    rowLabel.setAttribute('role', 'rowheader');
    rowWrapper.append(rowLabel, row);

    for (let hour = 0; hour < 24; hour++) {
      const index = dayIndex * 24 + hour;
      const value = weeklyBuckets[index] ?? 0;
      const intensity = maxValue > 0 ? value / maxValue : 0;
      const alpha = value > 0 ? (0.16 + intensity * 0.84).toFixed(3) : '0.06';
      const cell = el(
        'div',
        'h-8 rounded-[10px] border border-white/65 transition-transform duration-150 hover:scale-[1.06] hover:border-primary-300 dark:border-white/8 sm:h-9'
      );
      cell.setAttribute('role', 'gridcell');
      cell.setAttribute(
        'aria-label',
        `${dayLabel} ${formatBucketHour(hour)}: ${value.toLocaleString()} searches`
      );
      cell.title = `${dayLabel} ${formatBucketHour(hour)}: ${value.toLocaleString()} searches`;
      cell.style.background = `linear-gradient(135deg, rgba(59,130,246,${alpha}) 0%, rgba(34,211,238,${alpha}) 100%)`;
      row.append(cell);
    }

    container.append(rowWrapper);
  }
}

async function loadStatsModel(): Promise<StatsModel> {
  const [raw, mod] = await Promise.all([
    db.getSetting('frecency'),
    import('../generated/bangs-meta.js')
  ]);
  const snapshot = deserializeFrecencySnapshot(raw);
  const meta = mod.BANGS as Record<string, BangMeta>;

  return {
    weeklyBuckets: snapshot.weeklyBuckets,
    entries: Object.entries(snapshot.entries)
      .map(([trigger, entry]) => {
        const bangMeta = meta[trigger];
        return {
          trigger,
          count: entry.count,
          lastUsedAt: entry.lastUsedAt,
          queries: usageQueries(entry),
          score: entry.score,
          name: bangMeta?.s || 'Custom bang',
          domain: bangMeta?.d || ''
        };
      })
      .sort(
        (a, b) =>
          b.score - a.score ||
          b.count - a.count ||
          b.lastUsedAt - a.lastUsedAt ||
          a.trigger.localeCompare(b.trigger)
      )
  };
}

async function init() {
  const { entries, weeklyBuckets } = await loadStatsModel();

  if (entries.length === 0) {
    $('#stats-dashboard').classList.add('hidden');
    $('#stats-empty').classList.remove('hidden');
    return;
  }

  const totalUses = entries.reduce((sum, entry) => sum + entry.count, 0);
  const hottest = entries[0];
  const newest = [...entries].sort((a, b) => b.lastUsedAt - a.lastUsedAt)[0];
  const averageScore = Math.round(
    entries.reduce((sum, entry) => sum + entry.score, 0) / entries.length
  );

  $('#stats-summary').replaceChildren(
    summaryCard(
      'Total bang runs',
      totalUses.toLocaleString(),
      `Across ${entries.length.toLocaleString()} unique bangs on this device.`,
      'from-white via-primary-50/65 to-sky-50/92'
    ),
    summaryCard(
      'Hottest right now',
      `!${hottest.trigger}`,
      `${hottest.score.toLocaleString()} live score and ${hottest.count.toLocaleString()} total uses.`,
      'from-white via-cyan-50/75 to-sky-100/82'
    ),
    summaryCard(
      'Most recent',
      `!${newest.trigger}`,
      `Last used ${formatRelativeTime(newest.lastUsedAt)}.`,
      'from-white via-amber-50/72 to-orange-100/75'
    ),
    summaryCard(
      'Average heat',
      averageScore.toLocaleString(),
      'Average decayed score across your active bang set.',
      'from-white via-slate-50/82 to-blue-50/72'
    )
  );

  buildLeaderboard(entries);
  buildRecent(entries);
  buildFrequency(entries);
  buildQueryGroups(entries);
  buildHeatmap(weeklyBuckets);
}

init().catch(error => {
  console.error('Failed to load stats', error);
  $('#stats-dashboard').classList.add('hidden');
  $('#stats-empty').classList.remove('hidden');
});
