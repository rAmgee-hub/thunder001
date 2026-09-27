// 넥슨 Open API(메이플스토리) 연동과 캐릭터 장비 가치 계산.
// 문서: https://openapi.nexon.com/game/maplestory/
// API 키는 반드시 요청 헤더(x-nxopen-api-key)로만 보내고 코드/저장소에 넣지 않는다.

import { computeGrade, parsePotentialLines } from './potential.js';
import { estimatePrice } from './pricing.js';
import { matchItemName } from './trades.js';

export const NEXON_BASE = 'https://open.api.nexon.com/maplestory/v1';

const CLASS_MAIN_STAT = {
  STR: ['히어로', '팔라딘', '다크나이트', '소울마스터', '미하일', '블래스터', '데몬슬레이어', '아란', '카이저',
    '아델', '제로', '바이퍼', '캐논마스터', '캐논슈터', '스트라이커', '은월', '아크', '렌'],
  DEX: ['보우마스터', '신궁', '패스파인더', '윈드브레이커', '와일드헌터', '메르세데스', '캡틴', '메카닉',
    '엔젤릭버스터', '카인'],
  INT: ['아크메이지(불,독)', '아크메이지(썬,콜)', '비숍', '플레임위자드', '배틀메이지', '에반', '루미너스',
    '일리움', '라라', '키네시스'],
  LUK: ['나이트로드', '섀도어', '듀얼블레이더', '나이트워커', '팬텀', '카데나', '칼리', '호영'],
  HP: ['데몬어벤져'],
  XENON: ['제논'],
};

/** 직업명 → 주스탯 (모르는 직업이면 null → 잠재옵션으로 추정) */
export function mainStatOf(className) {
  const n = String(className ?? '').replace(/\s/g, '');
  for (const [stat, list] of Object.entries(CLASS_MAIN_STAT)) if (list.includes(n)) return stat;
  return null;
}

export class NexonClient {
  /**
   * @param {object} o
   * @param {string} [o.apiKey]  직접 호출할 때 키
   * @param {string} [o.baseUrl] 프록시(server.js)를 쓰면 '/api/nexon'
   * @param {typeof fetch} [o.fetch]
   */
  constructor({ apiKey, baseUrl = NEXON_BASE, fetch: f } = {}) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, '');
    // 브라우저 fetch는 window에 묶어 호출해야 한다 (Illegal invocation 방지)
    this.fetch = f ?? ((...args) => globalThis.fetch(...args));
  }

  async get(path, params = {}) {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v != null && v !== ''));
    const url = `${this.baseUrl}${path}${qs.size ? `?${qs}` : ''}`;
    const headers = this.apiKey ? { 'x-nxopen-api-key': this.apiKey } : {};
    const res = await this.fetch(url, { headers });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = body?.error?.message ?? body?.message ?? res.statusText;
      const err = new Error(`넥슨 API 오류 (${res.status}): ${msg}`);
      err.status = res.status;
      err.code = body?.error?.name;
      throw err;
    }
    return body;
  }

  async ocid(characterName) {
    const { ocid } = await this.get('/id', { character_name: characterName });
    return ocid;
  }

  basic(ocid, date) { return this.get('/character/basic', { ocid, date }); }
  equipment(ocid, date) { return this.get('/character/item-equipment', { ocid, date }); }
  linkSkill(ocid, date) { return this.get('/character/link-skill', { ocid, date }); }
  union(ocid, date) { return this.get('/user/union', { ocid, date }); }
  unionRaider(ocid, date) { return this.get('/user/union-raider', { ocid, date }); }
  /** 키를 발급한 넥슨 계정의 전체 캐릭터 목록 (본인 계정만 조회 가능) */
  characterList() { return this.get('/character/list'); }

  /** 캐릭터명 하나로 기본 정보 + 장비를 한 번에 */
  async character(characterName, date) {
    const id = await this.ocid(characterName);
    const [basic, equip] = await Promise.all([this.basic(id, date), this.equipment(id, date)]);
    return { ocid: id, basic, equipment: equip };
  }
}

/** /character/item-equipment 응답 → 장비 목록 */
export function mapEquipment(response) {
  return (response?.item_equipment ?? []).map((e) => ({
    slot: e.item_equipment_slot ?? e.item_equipment_part ?? '',
    name: e.item_name,
    icon: e.item_icon ?? null,
    starforce: e.starforce != null ? Number(e.starforce) : null,
    potentialGrade: e.potential_option_grade ?? null,
    potential: [e.potential_option_1, e.potential_option_2, e.potential_option_3].filter(Boolean),
    additionalGrade: e.additional_potential_option_grade ?? null,
    additional: [e.additional_potential_option_1, e.additional_potential_option_2, e.additional_potential_option_3].filter(Boolean),
  }));
}

/**
 * 장비별 급과 예상 시세, 합계를 계산
 * @returns {{ mainStat, items: Array, total, pricedCount, unpricedCount }}
 */
export function valueEquipment(items, trades, { mainStat, since } = {}) {
  const tradeItems = [...new Set(trades.map((t) => t.item))];
  const main = mainStat ?? null;
  let total = 0, pricedCount = 0;

  const rows = items.map((it) => {
    const lines = parsePotentialLines(it.potential);
    const { grade, mainStat: usedMain } = computeGrade(lines, { mainStat: main ?? undefined });
    const matched = matchItemName(it.name, tradeItems);
    const est = matched
      ? estimatePrice(trades, { item: matched, grade, starforce: it.starforce, since })
      : { method: 'none', expected: NaN };
    if (Number.isFinite(est.expected)) { total += est.expected; pricedCount++; }
    return { ...it, grade, mainStat: usedMain, matchedItem: matched, estimate: est };
  });

  return { mainStat: main, items: rows, total, pricedCount, unpricedCount: rows.length - pricedCount };
}
