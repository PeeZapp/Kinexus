import { formatMoney } from '../stash/money';
import { formatCostPerServe, formatCostSource, formatDishCost } from './cost';
import { MEAL_SLOTS, type Recipe } from './types';

export function recipePrintHtml(recipe: Recipe): string {
  const title = escapeHtml(recipe.name);
  const cuisine = recipe.cuisine?.trim() ? escapeHtml(recipe.cuisine.trim()) : 'Recipe';
  const cook = recipe.cookTime != null ? `${recipe.cookTime} min` : '—';
  const servings = recipe.servings != null ? `${recipe.servings} servings` : '—';
  const costLine = recipe.cost
    ? ` · ${formatCostPerServe(recipe.cost) ?? ''} · ${formatDishCost(recipe.cost) ?? ''} dish`
    : '';
  const slots = (recipe.mealSlots ?? [])
    .map((key) => MEAL_SLOTS.find((slot) => slot.key === key)?.label ?? key)
    .join(' · ');
  const photo = recipe.imageUrl
    ? `<img class="photo" src="${escapeAttr(recipe.imageUrl)}" alt="" />`
    : `<div class="emoji">${escapeHtml(recipe.emoji || '🍽️')}</div>`;
  const source = recipe.sourceUrl
    ? `<p class="source">From ${escapeHtml(recipe.sourceUrl)}</p>`
    : '';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title}</title>
  <style>${PRINT_CSS}</style>
</head>
<body>
  <article class="sheet">
    <header class="hero">
      <div class="media">${photo}</div>
      <div class="intro">
        <p class="brand">Kinexus</p>
        <h1>${title}</h1>
        <p class="meta">${cuisine} · ${cook} · ${servings}${costLine}</p>
        ${slots ? `<p class="slots">${escapeHtml(slots)}</p>` : ''}
        ${recipe.vegetarian ? '<p class="badge">Vegetarian</p>' : ''}
      </div>
    </header>
    <section class="macros" aria-label="Nutrition">
      ${macro('kcal', recipe.calories)}
      ${macro('protein', recipe.protein, 'g')}
      ${macro('carbs', recipe.carbs, 'g')}
      ${macro('fat', recipe.fat, 'g')}
    </section>
    ${recipe.cost ? `<p class="cost-note">${escapeHtml(formatCostSource(recipe.cost) ?? '')}</p>` : ''}
    <div class="body">
      <section>
        <h2>Ingredients</h2>
        ${ingredientsHtml(recipe)}
      </section>
      <section>
        <h2>Method</h2>
        ${methodHtml(recipe)}
      </section>
    </div>
    ${block('Chef tip', recipe.chefTip)}
    ${block('Notes', recipe.notes)}
    ${source}
  </article>
</body>
</html>`;
}

function ingredientsHtml(recipe: Recipe): string {
  const items = recipe.ingredients ?? [];
  if (items.length === 0) return '<p class="empty">No ingredients listed.</p>';
  return `<ul class="ingredients">${items
    .map((ing) => {
      const amount = ing.amount?.trim() ? `<span class="amount">${escapeHtml(ing.amount.trim())}</span> ` : '';
      const line = recipe.cost?.breakdown.find(
        (item) => item.name.trim().toLowerCase() === ing.name.trim().toLowerCase(),
      );
      const price = line ? ` <span class="line-cost">${escapeHtml(formatMoney(line.lineCost, recipe.cost?.currency))}</span>` : '';
      return `<li>${amount}${escapeHtml(ing.name)}${price}</li>`;
    })
    .join('')}</ul>`;
}

function methodHtml(recipe: Recipe): string {
  const steps = recipe.method ?? [];
  if (steps.length === 0) return '<p class="empty">No method listed.</p>';
  return `<ol class="method">${steps
    .map((step) => `<li>${escapeHtml(step)}</li>`)
    .join('')}</ol>`;
}

function block(heading: string, value?: string): string {
  const text = value?.trim();
  if (!text) return '';
  return `<section class="note"><h2>${escapeHtml(heading)}</h2><p>${escapeHtml(text)}</p></section>`;
}

function macro(label: string, value?: number, suffix = ''): string {
  const shown = value == null ? '—' : `${value}${suffix}`;
  return `<div class="macro"><strong>${escapeHtml(shown)}</strong><span>${escapeHtml(label)}</span></div>`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

const PRINT_CSS = `
  :root {
    color-scheme: light;
    --ink: #1c1917;
    --muted: #57534e;
    --rule: #d6d3d1;
    --accent: #0f766e;
    --paper: #fffdf9;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #e7e5e4;
    color: var(--ink);
    font: 15px/1.5 "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif;
  }
  .sheet {
    max-width: 800px;
    margin: 24px auto;
    background: var(--paper);
    padding: 32px 36px 40px;
    border-radius: 12px;
    box-shadow: 0 12px 40px rgba(28, 25, 23, 0.12);
  }
  .hero {
    display: grid;
    grid-template-columns: 168px 1fr;
    gap: 24px;
    align-items: center;
    margin-bottom: 22px;
  }
  .media, .photo, .emoji {
    width: 168px;
    height: 168px;
    border-radius: 16px;
    object-fit: cover;
    background: #f5f5f4;
  }
  .emoji {
    display: grid;
    place-items: center;
    font-size: 64px;
  }
  .brand {
    margin: 0 0 6px;
    color: var(--accent);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }
  h1 {
    margin: 0 0 8px;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 34px;
    line-height: 1.15;
    font-weight: 700;
  }
  .meta, .slots, .source, .empty {
    margin: 0;
    color: var(--muted);
  }
  .slots { margin-top: 4px; font-size: 13px; }
  .badge {
    display: inline-block;
    margin: 10px 0 0;
    padding: 3px 10px;
    border: 1px solid #99f6e4;
    border-radius: 999px;
    color: var(--accent);
    font-size: 12px;
    font-weight: 700;
  }
  .macros {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 10px;
    margin: 0 0 28px;
  }
  .macro {
    border: 1px solid var(--rule);
    border-radius: 10px;
    padding: 10px 12px;
  }
  .macro strong { display: block; font-size: 18px; }
  .macro span {
    color: var(--muted);
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .body section + section { margin-top: 26px; }
  h2 {
    margin: 0 0 12px;
    font-size: 13px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent);
  }
  .ingredients {
    margin: 0;
    padding: 0 0 0 1.15em;
    columns: 2;
    column-gap: 28px;
  }
  .method {
    margin: 0;
    padding: 0;
    list-style: none;
    counter-reset: step;
  }
  .ingredients li, .method li {
    margin: 0 0 8px;
    break-inside: avoid;
  }
  .method li {
    counter-increment: step;
    position: relative;
    padding: 0 0 12px 36px;
    margin: 0;
    white-space: pre-wrap;
    border-bottom: 1px solid var(--rule);
  }
  .method li:last-child { border-bottom: 0; padding-bottom: 0; }
  .method li::before {
    content: counter(step);
    position: absolute;
    left: 0;
    top: 1px;
    width: 24px;
    height: 24px;
    border-radius: 999px;
    border: 1px solid var(--accent);
    color: var(--accent);
    font-size: 12px;
    font-weight: 700;
    line-height: 22px;
    text-align: center;
  }
  .amount { font-weight: 700; }
  .line-cost { color: var(--muted); font-size: 12px; }
  .cost-note { color: var(--muted); font-size: 12px; margin: -16px 0 24px; }
  .note {
    margin-top: 22px;
    padding-top: 16px;
    border-top: 1px solid var(--rule);
  }
  .note p {
    margin: 0;
    white-space: pre-wrap;
  }
  .source {
    margin-top: 24px;
    font-size: 12px;
    word-break: break-word;
  }
  @media (max-width: 640px) {
    .hero, .macros { grid-template-columns: 1fr; }
    .media, .photo, .emoji { width: 100%; height: 200px; }
    .ingredients { columns: 1; }
  }
  @page { margin: 12mm; size: A4; }
  @media print {
    html, body { background: white; }
    .sheet {
      max-width: none;
      margin: 0;
      padding: 0;
      border-radius: 0;
      box-shadow: none;
    }
    .photo, .emoji { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .note, .method li, .ingredients li { break-inside: avoid; }
  }
`;
