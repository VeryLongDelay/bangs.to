function scoreItem(item: HTMLElement): number {
  const label = item.textContent?.trim() || '';

  const lengthWeight = Math.max(0.55, 1 - label.length / 80);

  return Math.random() * lengthWeight;
}

export function showSearchExamples(): void {
  const container = document.getElementById('example-list');

  if (!container) {
    return;
  }

  const count = Math.max(0, Number(container.dataset.count || 3));

  const items = Array.from(container.querySelectorAll<HTMLElement>('.example-item'));

  const selected = items
    .map(item => ({
      item,
      score: scoreItem(item)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, count);

  for (const { item } of selected) {
    item.classList.remove('hidden');
  }
}
