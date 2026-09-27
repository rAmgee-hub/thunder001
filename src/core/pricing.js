// 급 → 가격 모델과 적정가 판정.
// ln(가격) = a + b·급 (급이 오를수록 가격이 배수로 뛰는 특성에 맞춘 로그-선형 회귀)

import { filterTrades, median } from './trades.js';

export const MIN_FIT = 5; // 회귀에 필요한 최소 거래 수

/** points: [{grade, price}] → { a, b, r, n, sigma } / 부족하면 null */
export function fitGradeModel(points) {
  const pts = points.filter((p) => p.price > 0 && Number.isFinite(p.grade));
  const n = pts.length;
  if (n < MIN_FIT) return null;
  const xs = pts.map((p) => p.grade);
  const ys = pts.map((p) => Math.log(p.price));
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i] - mx) ** 2;
    sxy += (xs[i] - mx) * (ys[i] - my);
    syy += (ys[i] - my) ** 2;
  }
  if (sxx === 0) return null; // 모두 같은 급이면 기울기를 알 수 없음
  const b = sxy / sxx;
  const a = my - b * mx;
  const r = syy === 0 ? 1 : sxy / Math.sqrt(sxx * syy);
  let sse = 0;
  for (let i = 0; i < n; i++) sse += (ys[i] - (a + b * xs[i])) ** 2;
  const sigma = Math.sqrt(sse / Math.max(1, n - 2));
  return { a, b, r, n, sigma, gradeRange: [Math.min(...xs), Math.max(...xs)] };
}

/** 모델로 예상가와 68% 범위(±1σ) 계산 */
export function predict(model, grade) {
  const mu = model.a + model.b * grade;
  return {
    expected: Math.exp(mu),
    low: Math.exp(mu - model.sigma),
    high: Math.exp(mu + model.sigma),
    extrapolated: grade < model.gradeRange[0] || grade > model.gradeRange[1],
  };
}

/**
 * 아이템 한 개의 예상가.
 * 같은 스타포스 거래가 충분하면 그것만, 아니면 전체로 모델을 만든다.
 * 모델을 못 만들면 같은 급 거래 중앙값으로 대체한다.
 */
export function estimatePrice(trades, { item, grade, starforce, since }) {
  const base = filterTrades(trades, { item, since });
  let pool = base;
  let sfMatched = false;
  if (starforce != null) {
    const same = base.filter((t) => t.starforce === starforce);
    if (same.length >= MIN_FIT * 2) { pool = same; sfMatched = true; }
  }

  const model = fitGradeModel(pool);
  if (model) {
    return { method: 'model', model, sfMatched, sample: pool.length, ...predict(model, grade) };
  }

  const sameGrade = pool.filter((t) => Math.round(t.grade) === Math.round(grade)).map((t) => t.price);
  if (sameGrade.length) {
    const m = median(sameGrade);
    return { method: 'median', sfMatched, sample: sameGrade.length, expected: m, low: Math.min(...sameGrade), high: Math.max(...sameGrade), extrapolated: false };
  }
  return { method: 'none', sfMatched, sample: pool.length, expected: NaN, low: NaN, high: NaN, extrapolated: true };
}

/**
 * 판매 희망가가 적정한지 판정
 * verdict: 'cheap' | 'fair' | 'expensive' | 'unknown'
 */
export function judgePrice(askPrice, estimate) {
  if (!Number.isFinite(estimate.expected) || !(askPrice > 0)) {
    return { verdict: 'unknown', ratio: NaN, label: '비교할 거래가 부족해요' };
  }
  const ratio = askPrice / estimate.expected;
  let verdict = 'fair';
  if (askPrice < estimate.low) verdict = 'cheap';
  else if (askPrice > estimate.high) verdict = 'expensive';
  const pct = Math.round((ratio - 1) * 100);
  const label =
    verdict === 'cheap' ? `시세보다 ${-pct}% 저렴 — 급매일 수 있어요` :
    verdict === 'expensive' ? `시세보다 ${pct}% 비쌈 — 흥정 여지가 있어요` :
    `적정 범위 (시세 대비 ${pct >= 0 ? '+' : ''}${pct}%)`;
  return { verdict, ratio, label };
}
