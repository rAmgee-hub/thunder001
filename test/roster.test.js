import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JOBS, unionRank, flattenCharacterList, mainWorld, buildRoster, summarizeUnion, summarizeLinkSkills, findJob } from '../src/core/roster.js';

// /character/list 응답 형식의 축약 예시
const LIST = {
  account_list: [{
    account_id: 'acc',
    character_list: [
      { ocid: 'a', character_name: '레테본캐', world_name: '스카니아', character_class: '레테', character_level: 285 },
      { ocid: 'b', character_name: '은월부캐', world_name: '스카니아', character_class: '은월', character_level: 250 },
      { ocid: 'c', character_name: '비숍부캐', world_name: '스카니아', character_class: '비숍', character_level: 200 },
      { ocid: 'd', character_name: '비숍저렙', world_name: '스카니아', character_class: '비숍', character_level: 120 },
      { ocid: 'e', character_name: '다른월드', world_name: '루나', character_class: '히어로', character_level: 150 },
      { ocid: 'f', character_name: '캐논', world_name: '스카니아', character_class: '캐논 슈터', character_level: 65 },
      { ocid: 'g', character_name: '신직업', world_name: '스카니아', character_class: '없는직업', character_level: 100 },
    ],
  }],
};

test('참조표는 48직업', () => {
  assert.equal(JOBS.length, 48);
  assert.equal(findJob('데몬 어벤져').job, '데몬어벤져');
  assert.equal(findJob('캐논슈터').job, '캐논마스터');
});

test('유니온 등급', () => {
  assert.deepEqual([59, 60, 100, 140, 200, 250, 285].map(unionRank), [null, 'B', 'A', 'S', 'SS', 'SSS', 'SSS']);
});

test('계정 캐릭터 → 월드별 육성 현황', () => {
  const chars = flattenCharacterList(LIST);
  assert.equal(chars.length, 7);
  assert.equal(mainWorld(chars), '스카니아');

  const r = buildRoster(chars, { world: '스카니아' });
  assert.equal(r.summary.owned, 4); // 레테, 은월, 비숍(200), 캐논마스터
  assert.equal(r.rows.find((x) => x.job === '비숍').level, 200); // 같은 직업은 최고 레벨
  assert.equal(r.rows.find((x) => x.job === '히어로').character, null); // 다른 월드 제외
  assert.equal(r.summary.levelSum, 285 + 250 + 200 + 65);
  assert.equal(r.summary.lv285, 1);
  assert.deepEqual(r.summary.promotable, ['비숍']);
  assert.equal(r.unknown[0].job, '없는직업');
  const pirate = r.links.find((l) => l.link === '파이렛 블레스');
  assert.deepEqual([pirate.owned, pirate.total], [0, 3]); // 65레벨은 링크 미해금
  const mage = r.links.find((l) => l.link === '임피리컬 널리지');
  assert.deepEqual([mage.owned, mage.total], [1, 3]);
});

test('유니온/링크 응답 요약', () => {
  const u = summarizeUnion(
    { union_level: 8500, union_grade: '그랜드 마스터 유니온 1' },
    { union_raider_stat: ['보스 데미지 6% 증가'], union_occupied_stat: ['STR 5 증가'],
      union_block: [{ block_type: '전사', block_class: '히어로', block_level: '250' }] });
  assert.equal(u.level, 8500);
  assert.equal(u.blocks[0].level, 250);
  const l = summarizeLinkSkills({ character_link_skill: [{ skill_name: '와일드 레이지', skill_level: 2, skill_effect: '데미지 10% 증가' }] });
  assert.deepEqual(l[0], { name: '와일드 레이지', level: 2, effect: '데미지 10% 증가', icon: null });
});
