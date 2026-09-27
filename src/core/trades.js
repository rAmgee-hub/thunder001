// 거래 기록 정규화와 급별 묶음.
// 거래 1건 표준 형태: { item, grade, price, date, starforce?, server?, mainStat? }

import { parseMeso } from './meso.js';

const KEYS = {
  item: ['item', 'item_name', 'name', '아이템', '아이템명'],
  grade: ['grade', '급', '잠재급'],
  price: ['price', 'meso', '가격', '거래가'],
  date: ['date', 'traded_at', 'time', '거래일', '날짜'],
  starforce: ['starforce', 'star', '스타포스', '성'],
  server: ['server', 'world', '월드', '서버'],
  mainStat: ['mainStat', 'main_stat', '주스탯'],
};

function pick(raw, names) {
  for (const n of names) if (raw[n] !== undefined && raw[n] !== '') return raw[n];
  return undefined;
}

/** 여러 이름의 키를 표준 키로 맞춘다. 필수값(item/grade/price)이 없으면 null */
export function normalizeTrade(raw) {
  const item = pick(raw, KEYS.item);
  const grade = Number(pick(raw, KEYS.grade));
  const price = parseMeso(pick(raw, KEYS.price));
  if (!item || !Number.isFinite(grade) || !Number.isFinite(price) || price <= 0) return null;

  const dateRaw = pick(raw, KEYS.date);
  const date = dateRaw ? new Date(dateRaw) : null;
  const sf = pick(raw, KEYS.starforce);
  return {
    item: String(item).trim(),
    grade,
    price,
    date: date && !Number.isNaN(date.getTime()) ? date : null,
    starforce: sf !== undefined ? Number(sf) : null,
    server: pick(raw, KEYS.server) ?? null,
    mainStat: pick(raw, KEYS.mainStat) ?? null,
  };
}

export function normalizeTrades(rows) {
  return rows.map(normalizeTrade).filter(Boolean);
}

/** 따옴표를 지원하는 간단한 CSV 파서 (첫 줄은 헤더) */
export function parseCSV(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  const s = String(text).replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((v) => v !== '')) rows.push(row);
  if (!rows.length) return [];
  const [header, ...body] = rows;
  const keys = header.map((h) => h.trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

/** JSON 배열(또는 {trades:[...]}) 또는 CSV 텍스트 → 표준 거래 배열 */
export function loadTrades(text) {
  const t = String(text).trim();
  if (t.startsWith('[') || t.startsWith('{')) {
    const data = JSON.parse(t);
    return normalizeTrades(Array.isArray(data) ? data : data.trades ?? []);
  }
  return normalizeTrades(parseCSV(t));
}

export function median(values) {
  if (!values.length) return NaN;
  const a = [...values].sort((x, y) => x - y);
  const mid = a.length >> 1;
  return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
}

export function filterTrades(trades, { item, since, starforce, server } = {}) {
  return trades.filter((t) =>
    (!item || t.item === item) &&
    (!since || (t.date && t.date >= since)) &&
    (starforce == null || t.starforce == null || t.starforce === starforce) &&
    (!server || t.server == null || t.server === server));
}

/**
 * 급별 최근 거래 묶음 (급 내림차순)
 * 반환: [{ grade, count, median, min, max, lastDate, recent: [trade...] }]
 */
export function groupByGrade(trades, { recent = 5, ...filter } = {}) {
  const groups = new Map();
  for (const t of filterTrades(trades, filter)) {
    const g = Math.round(t.grade);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(t);
  }
  return [...groups.entries()]
    .map(([grade, list]) => {
      const sorted = [...list].sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0));
      const prices = list.map((t) => t.price);
      return {
        grade,
        count: list.length,
        median: median(prices),
        min: Math.min(...prices),
        max: Math.max(...prices),
        lastDate: sorted[0]?.date ?? null,
        recent: sorted.slice(0, recent),
      };
    })
    .sort((a, b) => b.grade - a.grade);
}

/** 거래 데이터에 있는 아이템 목록 (거래 많은 순) */
export function listItems(trades) {
  const counts = new Map();
  for (const t of trades) counts.set(t.item, (counts.get(t.item) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([item, count]) => ({ item, count }));
}

/**
 * 이름이 정확히 일치하지 않을 때 가장 비슷한 아이템명.
 * 공백 무시 일치 → 포함 관계 → 편집 거리(OCR 오타 1~2자 허용) 순. 애매하면 null.
 */
export function matchItemName(name, items) {
  if (!name) return null;
  const strip = (x) => x.replace(/\(\+\d+\)/g, '').replace(/\s/g, '');
  const n = strip(name);
  if (!n) return null;
  const exact = items.find((i) => strip(i) === n);
  if (exact) return exact;
  const contains = items.filter((i) => { const x = strip(i); return x.includes(n) || n.includes(x); })
    .sort((a, b) => strip(b).length - strip(a).length)[0];
  if (contains) return contains;
  let best = null, bestSim = 0;
  for (const i of items) {
    const x = strip(i);
    const sim = 1 - editDistance(n, x) / Math.max(n.length, x.length);
    if (sim > bestSim) { bestSim = sim; best = i; }
  }
  return bestSim >= 0.8 ? best : null;
}

function editDistance(a, b) {
  const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[b.length];
}
