// 육성 현황판: 넥슨 API의 계정 캐릭터 목록 → 직업별 육성 현황, 유니온 등급, 링크 스킬.
// 직업 참조표는 "메이플 육성 현황판" 리포트(2026.08)의 값을 옮긴 것이다.

// role: deal(딜) / surv(생존) / farm(사냥·성장) / stat(스탯)
export const JOBS = [
  ['모험가 · 전사', '히어로', 'STR 증가', '10 / 20 / 40 / 80 / 100', '인빈서블 빌리프', 'surv'],
  ['모험가 · 전사', '팔라딘', 'STR 증가', '10 / 20 / 40 / 80 / 100', '인빈서블 빌리프', 'surv'],
  ['모험가 · 전사', '다크나이트', '최대 HP 증가', '2 / 3 / 4 / 5 / 6%', '인빈서블 빌리프', 'surv'],
  ['모험가 · 마법사', '아크메이지(불,독)', '최대 MP 증가', '2 / 3 / 4 / 5 / 6%', '임피리컬 널리지', 'deal'],
  ['모험가 · 마법사', '아크메이지(썬,콜)', 'INT 증가', '10 / 20 / 40 / 80 / 100', '임피리컬 널리지', 'deal'],
  ['모험가 · 마법사', '비숍', 'INT 증가', '10 / 20 / 40 / 80 / 100', '임피리컬 널리지', 'deal'],
  ['모험가 · 궁수', '보우마스터', 'DEX 증가', '10 / 20 / 40 / 80 / 100', '어드벤처러 큐리어스', 'deal'],
  ['모험가 · 궁수', '신궁', '크리티컬 확률 증가', '1 / 2 / 3 / 4 / 5%', '어드벤처러 큐리어스', 'deal'],
  ['모험가 · 궁수', '패스파인더', 'DEX 증가', '10 / 20 / 40 / 80 / 100', '어드벤처러 큐리어스', 'deal'],
  ['모험가 · 도적', '나이트로드', '크리티컬 확률 증가', '1 / 2 / 3 / 4 / 5%', '시프 커닝', 'deal'],
  ['모험가 · 도적', '섀도어', 'LUK 증가', '10 / 20 / 40 / 80 / 100', '시프 커닝', 'deal'],
  ['모험가 · 도적', '듀얼블레이더', 'LUK 증가', '10 / 20 / 40 / 80 / 100', '시프 커닝', 'deal'],
  ['모험가 · 해적', '바이퍼', 'STR 증가', '10 / 20 / 40 / 80 / 100', '파이렛 블레스', 'stat'],
  ['모험가 · 해적', '캡틴', '소환수 지속시간 증가', '4 / 6 / 8 / 10 / 12%', '파이렛 블레스', 'stat'],
  ['모험가 · 해적', '캐논마스터', 'STR 증가', '10 / 20 / 40 / 80 / 100', '파이렛 블레스', 'stat'],
  ['시그너스 기사단', '소울마스터', '최대 HP 증가', '250 / 500 / 1000 / 2000 / 2500', '시그너스 블레스', 'stat'],
  ['시그너스 기사단', '플레임위자드', 'INT 증가', '10 / 20 / 40 / 80 / 100', '시그너스 블레스', 'stat'],
  ['시그너스 기사단', '윈드브레이커', 'DEX 증가', '10 / 20 / 40 / 80 / 100', '시그너스 블레스', 'stat'],
  ['시그너스 기사단', '나이트워커', 'LUK 증가', '10 / 20 / 40 / 80 / 100', '시그너스 블레스', 'stat'],
  ['시그너스 기사단', '스트라이커', 'STR 증가', '10 / 20 / 40 / 80 / 100', '시그너스 블레스', 'stat'],
  ['시그너스 기사단', '미하일', '최대 HP 증가', '250 / 500 / 1000 / 2000 / 2500', '빛의 수호', 'surv'],
  ['영웅', '아란', '타격 시 HP 회복 (70%)', '2 / 4 / 6 / 8 / 10%', '콤보킬 어드밴티지', 'farm'],
  ['영웅', '에반', '타격 시 MP 회복 (70%)', '2 / 4 / 6 / 8 / 10%', '룬 퍼시스턴스', 'farm'],
  ['영웅', '루미너스', 'INT 증가', '10 / 20 / 40 / 80 / 100', '퍼미에이트', 'deal'],
  ['영웅', '메르세데스', '재사용 대기시간 감소', '2 / 3 / 4 / 5 / 6%', '엘프의 축복', 'farm'],
  ['영웅', '팬텀', '메소 획득량 증가', '1 / 2 / 3 / 4 / 5%', '데들리 인스팅트', 'deal'],
  ['영웅', '은월', '크리티컬 데미지 증가', '1 / 2 / 3 / 5 / 6%', '구사일생', 'surv'],
  ['레지스탕스', '블래스터', '방어율 무시', '1 / 2 / 3 / 5 / 6%', '스피릿 오브 프리덤', 'surv'],
  ['레지스탕스', '배틀메이지', 'INT 증가', '10 / 20 / 40 / 80 / 100', '스피릿 오브 프리덤', 'surv'],
  ['레지스탕스', '와일드헌터', '20% 확률 데미지 증가', '4 / 8 / 12 / 16 / 20%', '스피릿 오브 프리덤', 'surv'],
  ['레지스탕스', '메카닉', '버프 지속시간 증가', '5 / 10 / 15 / 20 / 25%', '스피릿 오브 프리덤', 'surv'],
  ['레지스탕스', '데몬슬레이어', '상태이상 저항 증가', '1 / 2 / 3 / 4 / 5', '데몬스 퓨리', 'deal'],
  ['레지스탕스', '데몬어벤져', '보스 데미지 증가', '1 / 2 / 3 / 5 / 6%', '와일드 레이지', 'deal'],
  ['레지스탕스', '제논', 'STR / DEX / LUK 증가', '5 / 10 / 20 / 40 / 50', '하이브리드 로직', 'deal'],
  ['노바', '카이저', 'STR 증가', '10 / 20 / 40 / 80 / 100', '아이언 윌', 'surv'],
  ['노바', '카데나', 'LUK 증가', '10 / 20 / 40 / 80 / 100', '인텐시브 인썰트', 'farm'],
  ['노바', '엔젤릭버스터', 'DEX 증가', '10 / 20 / 40 / 80 / 100', '소울 컨트랙트', 'deal'],
  ['노바', '카인', 'DEX 증가', '10 / 20 / 40 / 80 / 100', null, 'deal'],
  ['레프', '아델', 'STR 증가', '10 / 20 / 40 / 80 / 100', '노블레스', 'deal'],
  ['레프', '일리움', 'INT 증가', '10 / 20 / 40 / 80 / 100', '전투의 흐름', 'deal'],
  ['레프', '아크', 'STR 증가', '10 / 20 / 40 / 80 / 100', '무아', 'deal'],
  ['레프', '칼리', 'LUK 증가', '10 / 20 / 40 / 80 / 100', null, 'deal'],
  ['아니마', '라라', 'INT 증가', '10 / 20 / 40 / 80 / 100', '자연의 벗', 'deal'],
  ['아니마', '호영', 'LUK 증가', '10 / 20 / 40 / 80 / 100', '자신감', 'deal'],
  ['아니마', '렌', '이동속도 / 최대 이동속도', '2 / 4 / 6 / 8 / 10', null, 'surv'],
  ['그 외', '제로', '경험치 획득량 증가', '4 / 6 / 8 / 10 / 12%', '륀느의 축복', 'surv'],
  ['그 외', '키네시스', 'INT 증가', '10 / 20 / 40 / 80 / 100', '판단', 'deal'],
  ['그 외', '레테', '올스탯 + 최대 HP 증가', '10·500 / 20·1000 / 30·1500 / 40·2000 / 50·2500', '커버넌트', 'deal'],
].map(([group, job, union, unionValues, link, role]) => ({ group, job, union, unionValues, link, role }));

// 넥슨 API 직업명이 참조표와 다른 경우
const ALIASES = { 캐논슈터: '캐논마스터' };

export const normJob = (name) => {
  const n = String(name ?? '').replace(/\s/g, '');
  return ALIASES[n] ?? n;
};

const JOB_INDEX = new Map(JOBS.map((j) => [normJob(j.job), j]));
export const findJob = (className) => JOB_INDEX.get(normJob(className)) ?? null;

/** 레벨 → 유니온 공격대원 등급 (60/100/140/200/250) */
export function unionRank(level) {
  if (!(level >= 60)) return null;
  if (level >= 250) return 'SSS';
  if (level >= 200) return 'SS';
  if (level >= 140) return 'S';
  if (level >= 100) return 'A';
  return 'B';
}

/** /character/list 응답 → 평평한 캐릭터 배열 */
export function flattenCharacterList(response) {
  return (response?.account_list ?? []).flatMap((acc) =>
    (acc.character_list ?? []).map((c) => ({
      ocid: c.ocid,
      name: c.character_name,
      world: c.world_name,
      job: c.character_class,
      level: Number(c.character_level) || 0,
    })));
}

/** 월드별 레벨 합이 가장 큰 월드 (본캐 월드 추정) */
export function mainWorld(characters) {
  const sums = {};
  for (const c of characters) sums[c.world] = (sums[c.world] ?? 0) + c.level;
  return Object.entries(sums).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/**
 * 한 월드의 직업별 육성 현황.
 * 같은 직업이 여럿이면 가장 높은 레벨 캐릭터를 대표로 쓴다 (유니온도 직업당 1명만 효과).
 */
export function buildRoster(characters, { world } = {}) {
  const pool = world ? characters.filter((c) => c.world === world) : characters;
  const best = new Map();
  const unknown = [];
  for (const c of pool) {
    const ref = findJob(c.job);
    if (!ref) { unknown.push(c); continue; }
    const key = normJob(ref.job);
    if (!best.has(key) || best.get(key).level < c.level) best.set(key, c);
  }

  const rows = JOBS.map((ref) => {
    const c = best.get(normJob(ref.job)) ?? null;
    return { ...ref, character: c, level: c?.level ?? null, rank: c ? unionRank(c.level) : null };
  });

  const owned = rows.filter((r) => r.character);
  const linkStatus = {};
  for (const r of rows) {
    if (!r.link) continue;
    const s = (linkStatus[r.link] ??= { link: r.link, total: 0, owned: 0, jobs: [] });
    s.total++;
    s.jobs.push(r.job);
    if (r.level != null && r.level >= 70) s.owned++; // 링크 1레벨은 70부터
  }

  return {
    world: world ?? null,
    rows,
    unknown,
    summary: {
      owned: owned.length,
      total: JOBS.length,
      levelSum: owned.reduce((s, r) => s + r.level, 0),
      sss: owned.filter((r) => r.rank === 'SSS').map((r) => `${r.job} ${r.level}`),
      lv285: owned.filter((r) => r.level >= 285).length, // 찬란한 영웅의 증거는 285 캐릭터당 1개
      promotable: owned.filter((r) => r.level >= 200 && r.level < 250).map((r) => r.job),
    },
    links: Object.values(linkStatus),
  };
}

/** /user/union + /user/union-raider 응답 요약 */
export function summarizeUnion(union, raider) {
  return {
    level: union?.union_level ?? null,
    grade: union?.union_grade ?? null,
    raiderEffects: raider?.union_raider_stat ?? [],
    occupiedEffects: raider?.union_occupied_stat ?? [],
    blocks: (raider?.union_block ?? []).map((b) => ({ job: b.block_class, level: Number(b.block_level) || null, type: b.block_type })),
  };
}

/** /character/link-skill 응답 → 장착 링크 목록 */
export function summarizeLinkSkills(response) {
  return (response?.character_link_skill ?? []).map((s) => ({
    name: s.skill_name,
    level: Number(s.skill_level) || null,
    effect: s.skill_effect ?? s.skill_description ?? '',
    icon: s.skill_icon ?? null,
  }));
}
