// 잠재옵션 한 줄 파싱과 "급"(주스탯% 합산) 계산.
// 입력은 게임 툴팁/OCR 텍스트("STR : +12%")나 넥슨 Open API 값("STR : +12%") 모두 받는다.

const STAT_ALIASES = [
  [/^올\s*스탯$/, 'ALL'],
  [/^(STR|DEX|INT|LUK)$/i, (m) => m[1].toUpperCase()],
  [/^최대\s*HP$/i, 'HP'],
  [/^최대\s*MP$/i, 'MP'],
  [/^공격력$/, 'ATT'],
  [/^마력$/, 'MATT'],
  [/^보스\s*몬스터\s*공격\s*시\s*데미지$/, 'BOSS'],
  [/^몬스터\s*방어율\s*무시$/, 'IED'],
  [/^데미지$/, 'DMG'],
  [/^크리티컬\s*데미지$/, 'CRIT_DMG'],
  [/^크리티컬\s*확률$/, 'CRIT_RATE'],
  [/^스킬\s*재사용\s*대기시간$/, 'COOLDOWN'],
  [/^메소\s*획득량$/, 'MESO'],
  [/^아이템\s*드롭률$/, 'DROP'],
];

export const STAT_LABELS = {
  ALL: '올스탯', STR: 'STR', DEX: 'DEX', INT: 'INT', LUK: 'LUK', HP: '최대 HP', MP: '최대 MP',
  ATT: '공격력', MATT: '마력', BOSS: '보공', IED: '방무', DMG: '데미지',
  CRIT_DMG: '크뎀', CRIT_RATE: '크확', COOLDOWN: '쿨감', MESO: '메획', DROP: '아획',
};

function resolveStat(name) {
  const clean = name.trim();
  for (const [re, out] of STAT_ALIASES) {
    const m = clean.match(re);
    if (m) return typeof out === 'function' ? out(m) : out;
  }
  return null;
}

/** OCR에서 흔한 전각/유사 문자를 정리 */
export function normalizeText(text) {
  return String(text ?? '')
    .replace(/[：﹕]/g, ':')
    .replace(/[＋]/g, '+')
    .replace(/[－—–]/g, '-')
    .replace(/[％]/g, '%')
    .replace(/[ \t ]+/g, ' ')
    .trim();
}

/**
 * 잠재옵션 한 줄 → { stat, value, unit, perLevel, raw } / 해석 불가 시 null
 *  "STR : +12%"                    → { stat:'STR', value:12, unit:'%' }
 *  "캐릭터 기준 9레벨 당 LUK : +2"  → { stat:'LUK', value:2, unit:'', perLevel:9 }
 *  "스킬 재사용 대기시간 : -2초"     → { stat:'COOLDOWN', value:2, unit:'초' }
 */
export function parsePotentialLine(line) {
  const raw = normalizeText(line);
  if (!raw) return null;

  let body = raw;
  let perLevel = null;
  const lv = body.match(/^캐릭터\s*기준\s*(\d+)\s*레벨\s*당\s*/);
  if (lv) {
    perLevel = Number(lv[1]);
    body = body.slice(lv[0].length);
  }

  const m = body.match(/^(.+?)\s*:?\s*([+-])\s*(\d+(?:\.\d+)?)\s*(%|초)?\s*$/);
  if (!m) return null;
  const stat = resolveStat(m[1]);
  if (!stat) return null;
  return { stat, value: Number(m[3]), unit: m[4] ?? '', perLevel, raw };
}

export function parsePotentialLines(lines) {
  return (lines ?? []).map(parsePotentialLine).filter(Boolean);
}

/** 주스탯 종류. XENON은 STR/DEX/LUK를 모두 쓰는 제논, HP는 데몬 어벤져 */
export const MAIN_STATS = ['STR', 'DEX', 'INT', 'LUK', 'HP', 'XENON'];

export const DEFAULT_WEIGHTS = {
  allStat: 1,     // 올스탯 1% = 주스탯 1급
  perLevel: 0,    // "N레벨 당 주스탯 +1" 한 줄의 급 환산치 (기본 미반영)
  critDmg: 0,     // 크뎀 1% 당 급 (장갑 평가 시 조정)
  cooldown: 0,    // 쿨감 1초 당 급 (모자 평가 시 조정)
};

/**
 * 급 계산. mainStat을 생략하면 가장 많이 붙은 주스탯으로 추정한다.
 * 반환: { grade, mainStat, breakdown: [{stat,value,contrib}] }
 */
export function computeGrade(lines, { mainStat, weights } = {}) {
  const parsed = lines.every?.((l) => typeof l === 'object' && l?.stat) ? lines : parsePotentialLines(lines);
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  const main = mainStat ?? guessMainStat(parsed);
  const breakdown = [];
  let grade = 0;

  for (const p of parsed) {
    let contrib = 0;
    if (p.perLevel) {
      if (statMatchesMain(p.stat, main)) contrib = w.perLevel;
    } else if (p.stat === 'ALL' && p.unit === '%' && main !== 'HP') {
      contrib = p.value * w.allStat;
    } else if (p.unit === '%' && statMatchesMain(p.stat, main)) {
      // 제논은 한 종류 스탯%가 주스탯 1/3 가치
      contrib = main === 'XENON' ? p.value / 3 : p.value;
    } else if (p.stat === 'CRIT_DMG') {
      contrib = p.value * w.critDmg;
    } else if (p.stat === 'COOLDOWN') {
      contrib = p.value * w.cooldown;
    }
    if (contrib) breakdown.push({ stat: p.stat, value: p.value, contrib });
    grade += contrib;
  }
  return { grade: Math.round(grade * 100) / 100, mainStat: main, breakdown };
}

function statMatchesMain(stat, main) {
  if (main === 'XENON') return stat === 'STR' || stat === 'DEX' || stat === 'LUK';
  return stat === main;
}

export function guessMainStat(parsed) {
  const sums = {};
  for (const p of parsed) {
    if (p.unit !== '%' || p.perLevel) continue;
    if (['STR', 'DEX', 'INT', 'LUK', 'HP'].includes(p.stat)) sums[p.stat] = (sums[p.stat] ?? 0) + p.value;
  }
  const best = Object.entries(sums).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : 'STR';
}

/** 에디셔널 요약: 주스탯% 급과 공/마 고정치 */
export function summarizeAdditional(lines, { mainStat } = {}) {
  const parsed = parsePotentialLines(lines);
  const main = mainStat ?? guessMainStat(parsed);
  const { grade } = computeGrade(parsed, { mainStat: main });
  const att = parsed.filter((p) => p.stat === 'ATT' && !p.unit && !p.perLevel).reduce((s, p) => s + p.value, 0);
  const matt = parsed.filter((p) => p.stat === 'MATT' && !p.unit && !p.perLevel).reduce((s, p) => s + p.value, 0);
  return { grade, att, matt, mainStat: main };
}
