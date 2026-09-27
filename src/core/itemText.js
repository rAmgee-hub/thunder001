// 아이템 툴팁 텍스트(스크린샷 OCR 결과 또는 복사한 글) → 구조화된 아이템 정보

import { normalizeText, parsePotentialLine } from './potential.js';

const GRADES = ['레어', '에픽', '유니크', '레전드리'];

const NOISE = /^(REQ|요구|장비분류|공격력 증가량|업그레이드 가능 횟수|착용 가능|교환|거래|고유|파괴|전투력|잠재옵션|에디셔널)/;

/**
 * 반환 예:
 * { name, starforce, potentialGrade, potential: [line...], additionalGrade, additional: [line...], unparsed: [...] }
 */
export function parseItemText(text) {
  const lines = normalizeText(text).split(/\r?\n/).map((l) => normalizeText(l)).filter(Boolean);

  const result = {
    name: null,
    starforce: null,
    potentialGrade: null,
    potential: [],
    additionalGrade: null,
    additional: [],
    unparsed: [],
  };

  // 스타포스: "22성" 표기 또는 ★ 개수
  const joined = lines.join('\n');
  const sf = joined.match(/(\d{1,2})\s*성(?:\s*강화)?/);
  if (sf && Number(sf[1]) <= 25) result.starforce = Number(sf[1]);
  else {
    const stars = (joined.match(/★/g) ?? []).length;
    if (stars) result.starforce = Math.min(stars, 25);
  }

  let section = null; // 'potential' | 'additional'
  for (const line of lines) {
    if (/에디셔널\s*잠재/.test(line)) {
      section = 'additional';
      result.additionalGrade = findGrade(line) ?? result.additionalGrade;
      continue;
    }
    if (/잠재\s*옵션|잠재능력/.test(line)) {
      section = 'potential';
      result.potentialGrade = findGrade(line) ?? result.potentialGrade;
      continue;
    }
    if (/\((레어|에픽|유니크|레전드리)\s*아이템\)/.test(line) && !result.potentialGrade) {
      result.potentialGrade = findGrade(line);
      continue;
    }

    const opt = parsePotentialLine(line);
    if (opt) {
      if (section === 'additional') result.additional.push(opt.raw);
      else if (section === 'potential') result.potential.push(opt.raw);
      else result.unparsed.push(line); // 섹션 헤더 전 옵션은 기본 스탯일 가능성이 높음
      continue;
    }

    if (!result.name && looksLikeName(line)) {
      result.name = line.replace(/\(\+\d+\)/, '').replace(/★/g, '').trim();
      continue;
    }
    result.unparsed.push(line);
  }

  // 섹션 헤더를 못 읽었다면(OCR 누락) 옵션 줄을 앞 3줄 윗잠 / 나머지 에디로 추정
  if (!result.potential.length && !result.additional.length) {
    const opts = result.unparsed.filter((l) => parsePotentialLine(l));
    if (opts.length >= 3) {
      const tail = opts.slice(-6);
      result.potential = tail.slice(0, Math.min(3, tail.length));
      result.additional = tail.slice(3);
      result.unparsed = result.unparsed.filter((l) => !tail.includes(l));
      result.guessedSections = true;
    }
  }
  return result;
}

function findGrade(line) {
  return GRADES.find((g) => line.includes(g)) ?? null;
}

function looksLikeName(line) {
  if (NOISE.test(line)) return false;
  if (/\d+\s*성/.test(line) && line.length < 6) return false;
  const hangul = (line.match(/[가-힣]/g) ?? []).length;
  return hangul >= 3 && line.length <= 30 && !line.includes(':');
}
