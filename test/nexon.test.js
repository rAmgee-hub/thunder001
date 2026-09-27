import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NexonClient, mapEquipment, mainStatOf, valueEquipment } from '../src/core/nexon.js';
import { sampleTrades } from '../src/core/sample.js';

// 넥슨 Open API /character/item-equipment 응답 형식의 축약 예시
const EQUIP = {
  date: '2026-09-26T00:00+09:00',
  character_class: '히어로',
  item_equipment: [
    {
      item_equipment_part: '모자', item_equipment_slot: '모자', item_name: '아케인셰이드 나이트햇',
      starforce: '22', potential_option_grade: '레전드리',
      potential_option_1: 'STR : +12%', potential_option_2: 'STR : +9%', potential_option_3: '올스탯 : +6%',
      additional_potential_option_grade: '에픽',
      additional_potential_option_1: '공격력 : +10', additional_potential_option_2: 'STR : +4%', additional_potential_option_3: null,
    },
    {
      item_equipment_part: '반지', item_equipment_slot: '반지1', item_name: '어떤 반지',
      starforce: '0', potential_option_grade: null,
      potential_option_1: null, potential_option_2: null, potential_option_3: null,
    },
  ],
};

test('직업 → 주스탯', () => {
  assert.equal(mainStatOf('히어로'), 'STR');
  assert.equal(mainStatOf('데몬 어벤져'), 'HP');
  assert.equal(mainStatOf('아크메이지(불,독)'), 'INT');
  assert.equal(mainStatOf('없는직업'), null);
});

test('장비 응답 매핑', () => {
  const items = mapEquipment(EQUIP);
  assert.equal(items.length, 2);
  assert.equal(items[0].starforce, 22);
  assert.equal(items[0].potential.length, 3);
  assert.equal(items[0].additional.length, 2);
  assert.equal(items[1].potential.length, 0);
});

test('장비 가치 합산', () => {
  const trades = sampleTrades({ now: new Date('2026-09-27') });
  const items = mapEquipment(EQUIP);
  items[0].name = '아케인셰이드 모자'; // 샘플 데이터에 있는 이름으로
  const v = valueEquipment(items, trades, { mainStat: 'STR' });
  assert.equal(v.items[0].grade, 27);
  assert.equal(v.pricedCount, 1);
  assert.equal(v.unpricedCount, 1);
  assert.ok(v.total > 0);
});

test('클라이언트: 키 헤더, 쿼리, 오류 메시지', async () => {
  const calls = [];
  const fake = async (url, opts) => {
    calls.push({ url, opts });
    if (url.includes('/id?')) return { ok: true, json: async () => ({ ocid: 'abc' }) };
    if (url.includes('/character/basic')) return { ok: true, json: async () => ({ character_class: '히어로' }) };
    if (url.includes('/character/item-equipment')) return { ok: true, json: async () => EQUIP };
    return { ok: false, status: 400, statusText: 'Bad', json: async () => ({ error: { name: 'OPENAPI00004', message: 'Please input valid parameter' } }) };
  };
  const c = new NexonClient({ apiKey: 'KEY', fetch: fake });
  const r = await c.character('테스트캐릭');
  assert.equal(r.ocid, 'abc');
  assert.equal(calls[0].opts.headers['x-nxopen-api-key'], 'KEY');
  assert.ok(calls[0].url.includes(encodeURIComponent('테스트캐릭')));
  await assert.rejects(c.get('/nope'), /400.*valid parameter/);
});
