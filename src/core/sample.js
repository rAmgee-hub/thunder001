// 화면 시연용 **가상** 거래 데이터. 실제 시세가 아니다.
// 실제 데이터는 화면에서 CSV/JSON 파일로 불러오면 이 샘플을 대체한다.

const ITEMS = [
  { item: '아케인셰이드 모자', base: 9e8, slope: 0.16 },
  { item: '아케인셰이드 망토', base: 6e8, slope: 0.15 },
  { item: '앱솔랩스 신발', base: 2.5e8, slope: 0.14 },
  { item: '에테르넬 숄더', base: 30e8, slope: 0.17 },
];
const GRADES = [15, 18, 21, 21, 24, 24, 27, 30, 33];
const STARFORCE = [17, 17, 18, 22];

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/** now 기준 최근 days일 동안의 가상 거래 */
export function sampleTrades({ now = new Date(), days = 30, perItem = 60, seed = 42 } = {}) {
  const rand = rng(seed);
  const out = [];
  for (const it of ITEMS) {
    for (let i = 0; i < perItem; i++) {
      const grade = GRADES[Math.floor(rand() * GRADES.length)];
      const starforce = STARFORCE[Math.floor(rand() * STARFORCE.length)];
      const sfBoost = starforce === 22 ? 2.2 : starforce === 18 ? 1.15 : 1;
      const noise = Math.exp((rand() + rand() + rand() - 1.5) * 0.25);
      const price = Math.round((it.base * Math.exp(it.slope * (grade - 21)) * sfBoost * noise) / 1e6) * 1e6;
      const date = new Date(now.getTime() - rand() * days * 864e5);
      out.push({ item: it.item, grade, price, date, starforce, server: null, mainStat: null });
    }
  }
  return out;
}
