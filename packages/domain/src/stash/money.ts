export function parseMoney(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? roundMoney(raw) : null;
  const cleaned = raw.replace(/[^0-9.,-]/g, '').replace(/,(?=\d{3}\b)/g, '');
  if (!cleaned || !/[0-9]/.test(cleaned)) return null;
  const normalized = cleaned.includes(',') && !cleaned.includes('.') ? cleaned.replace(',', '.') : cleaned.replace(/,/g, '');
  const value = Number(normalized);
  return Number.isFinite(value) ? roundMoney(value) : null;
}

export function moneyExpressionHasOp(raw: string): boolean {
  return /[+]/.test(raw) || /[*\/()]/.test(raw) || /[0-9.]\s*-/.test(raw);
}

export function evalMoneyExpression(raw: string | number | null | undefined): number | null {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? roundMoney(raw) : null;
  if (!moneyExpressionHasOp(raw)) return parseMoney(raw);
  const tokens = tokenizeMoneyExpression(raw);
  if (!tokens) return null;
  let index = 0;
  const peek = () => tokens[index] ?? null;
  const eat = () => tokens[index++] ?? null;
  const parseExpression = (): number | null => {
    let left = parseTerm();
    if (left == null) return null;
    while (peek() === '+' || peek() === '-') {
      const op = eat();
      const right = parseTerm();
      if (right == null) return null;
      left = op === '+' ? left + right : left - right;
    }
    return left;
  };
  const parseTerm = (): number | null => {
    let left = parseFactor();
    if (left == null) return null;
    while (peek() === '*' || peek() === '/') {
      const op = eat();
      const right = parseFactor();
      if (right == null) return null;
      if (op === '/') {
        if (right === 0) return null;
        left = left / right;
      } else {
        left = left * right;
      }
    }
    return left;
  };
  const parseFactor = (): number | null => {
    const token = peek();
    if (token === '-') {
      eat();
      const value = parseFactor();
      return value == null ? null : -value;
    }
    if (token === '(') {
      eat();
      const value = parseExpression();
      if (eat() !== ')') return null;
      return value;
    }
    if (token && /^\d/.test(token)) {
      eat();
      const value = Number(token);
      return Number.isFinite(value) ? value : null;
    }
    return null;
  };
  const value = parseExpression();
  if (value == null || index !== tokens.length || !Number.isFinite(value)) return null;
  return roundMoney(value);
}

function tokenizeMoneyExpression(raw: string): string[] | null {
  const cleaned = raw.replace(/\$/g, '').replace(/,/g, '');
  const tokens: string[] = [];
  let i = 0;
  while (i < cleaned.length) {
    const ch = cleaned[i]!;
    if (/\s/.test(ch)) {
      i += 1;
      continue;
    }
    if ('+-*/()'.includes(ch)) {
      tokens.push(ch);
      i += 1;
      continue;
    }
    if (/\d/.test(ch) || ch === '.') {
      let j = i;
      let dots = 0;
      while (j < cleaned.length && (/\d/.test(cleaned[j]!) || cleaned[j] === '.')) {
        if (cleaned[j] === '.') dots += 1;
        j += 1;
      }
      const num = cleaned.slice(i, j);
      if (dots > 1 || num === '.' || !/\d/.test(num)) return null;
      tokens.push(num);
      i = j;
      continue;
    }
    return null;
  }
  return tokens.length > 0 ? tokens : null;
}

export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatMoney(amount: number | string | null | undefined, currency = 'AUD'): string {
  const value = typeof amount === 'string' ? Number(amount.replace(/,/g, '')) : amount;
  if (value == null || !Number.isFinite(value)) return '—';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'AUD' }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency || ''}`.trim();
  }
}

export function isSale(currentPrice: number | null, originalPrice: number | null): boolean {
  if (currentPrice == null || originalPrice == null) return false;
  return currentPrice < originalPrice;
}
