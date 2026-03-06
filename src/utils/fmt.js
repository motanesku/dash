export const fmtC = (n, cur = 'USD') => {
  if (n == null || isNaN(n)) return '—'
  try {
    return new Intl.NumberFormat('ro-RO', {
      style: 'currency', currency: cur,
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(n)
  } catch {
    return `${n.toFixed(2)} ${cur}`
  }
}

export const fmtN = (n, d = 2) =>
  n == null || isNaN(n) ? '—' : (n >= 0 ? '+' : '') + n.toFixed(d)

export const fmtPct = (n) =>
  n == null || isNaN(n) ? '—' : (n >= 0 ? '+' : '') + n.toFixed(2) + '%'

export const fmtBig = (n) => {
  if (n == null || isNaN(n)) return '—'
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + 'B'
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return n.toFixed(2)
}

export const cls = (n) =>
  n == null || isNaN(n) ? 'text-zinc-400' : n >= 0 ? 'text-emerald-500' : 'text-red-500'

export const clsBg = (n) =>
  n == null || isNaN(n) ? '' : n >= 0 ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
