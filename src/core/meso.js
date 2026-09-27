// 메소 금액 파싱/표기. 1억 = 100,000,000 / 1만 = 10,000

const EOK = 100_000_000;
const MAN = 10_000;

/**
 * "12억 3,000만", "1.5억", "3000만", "1230000000", 1230000000 → 숫자(메소)
 * 해석할 수 없으면 NaN.
 */
export function parseMeso(input) {
  if (typeof input === 'number') return input;
  if (input == null) return NaN;
  const s = String(input).replace(/[,\s]/g, '').replace(/메소$/, '');
  if (s === '') return NaN;
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);

  const m = s.match(/^(?:(\d+(?:\.\d+)?)억)?(?:(\d+(?:\.\d+)?)만)?(\d+)?$/);
  if (!m || (!m[1] && !m[2])) return NaN;
  const eok = m[1] ? Number(m[1]) : 0;
  const man = m[2] ? Number(m[2]) : 0;
  const rest = m[3] ? Number(m[3]) : 0;
  return Math.round(eok * EOK + man * MAN + rest);
}

/** 1230000000 → "12억 3,000만" (만 단위 아래는 버림) */
export function formatMeso(value) {
  if (!Number.isFinite(value)) return '-';
  const neg = value < 0;
  let v = Math.round(Math.abs(value) / MAN); // 만 단위
  const eok = Math.floor(v / MAN);
  const man = v % MAN;
  const parts = [];
  if (eok) parts.push(`${eok.toLocaleString('ko-KR')}억`);
  if (man) parts.push(`${man.toLocaleString('ko-KR')}만`);
  if (!parts.length) parts.push('0');
  return (neg ? '-' : '') + parts.join(' ');
}
