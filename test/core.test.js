import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMeso, formatMeso } from '../src/core/meso.js';
import { parsePotentialLine, computeGrade, summarizeAdditional } from '../src/core/potential.js';
import { parseItemText } from '../src/core/itemText.js';
import { loadTrades, groupByGrade, matchItemName } from '../src/core/trades.js';
import { fitGradeModel, estimatePrice, judgePrice } from '../src/core/pricing.js';
import { sampleTrades } from '../src/core/sample.js';

test('메소 파싱/표기', () => {
  assert.equal(parseMeso('12억 3,000만'), 1_230_000_000);
  assert.equal(parseMeso('1.5억'), 150_000_000);
  assert.equal(parseMeso('3000만'), 30_000_000);
  assert.equal(parseMeso('1230000000'), 1_230_000_000);
  assert.ok(Number.isNaN(parseMeso('abc')));
  assert.equal(formatMeso(1_230_000_000), '12억 3,000만');
  assert.equal(formatMeso(50_000_000), '5,000만');
});

test('잠재옵션 줄 파싱', () => {
  assert.deepEqual(
    (({ stat, value, unit }) => ({ stat, value, unit }))(parsePotentialLine('STR : +12%')),
    { stat: 'STR', value: 12, unit: '%' });
  assert.equal(parsePotentialLine('올스탯 : +9%').stat, 'ALL');
  assert.equal(parsePotentialLine('캐릭터 기준 9레벨 당 LUK : +2').perLevel, 9);
  assert.equal(parsePotentialLine('스킬 재사용 대기시간 : -2초').stat, 'COOLDOWN');
  assert.equal(parsePotentialLine('보스 몬스터 공격 시 데미지 : +40%').stat, 'BOSS');
  assert.equal(parsePotentialLine('STR：＋12％').value, 12); // OCR 전각 문자
  assert.equal(parsePotentialLine('착용 레벨 감소'), null);
});

test('급 계산', () => {
  assert.equal(computeGrade(['STR : +12%', 'STR : +9%', '올스탯 : +9%']).grade, 30);
  assert.equal(computeGrade(['LUK : +12%', 'STR : +9%', 'LUK : +9%']).grade, 21);
  assert.equal(computeGrade(['LUK : +12%', 'LUK : +9%'], { mainStat: 'STR' }).grade, 0);
  assert.equal(computeGrade(['최대 HP : +12%', '올스탯 : +9%'], { mainStat: 'HP' }).grade, 12);
  assert.equal(computeGrade(['STR : +12%', 'DEX : +9%', 'LUK : +9%'], { mainStat: 'XENON' }).grade, 10);
  assert.equal(computeGrade(['크리티컬 데미지 : +8%', 'DEX : +9%'], { mainStat: 'DEX', weights: { critDmg: 1.5 } }).grade, 21);
  const add = summarizeAdditional(['공격력 : +10', 'STR : +7%', '공격력 : +11'], { mainStat: 'STR' });
  assert.deepEqual([add.att, add.grade], [21, 7]);
});

test('툴팁 텍스트 파싱', () => {
  const text = `22성
아케인셰이드 나이트햇 (+8)
(레전드리 아이템)
STR : +40
잠재옵션 레전드리
STR : +12%
STR : +9%
올스탯 : +6%
에디셔널 잠재옵션 에픽
공격력 : +10
STR : +4%`;
  const r = parseItemText(text);
  assert.equal(r.starforce, 22);
  assert.equal(r.name, '아케인셰이드 나이트햇');
  assert.equal(r.potentialGrade, '레전드리');
  assert.equal(r.potential.length, 3);
  assert.equal(r.additionalGrade, '에픽');
  assert.equal(r.additional.length, 2);
  assert.equal(computeGrade(r.potential).grade, 27);
});

test('섹션 제목을 못 읽은 OCR 텍스트도 옵션 줄을 추정', () => {
  const r = parseItemText('앱솔랩스 신발\nDEX : +12%\nDEX : +9%\nDEX : +9%');
  assert.equal(r.guessedSections, true);
  assert.equal(computeGrade(r.potential).grade, 30);
});

test('CSV 불러오기와 급별 묶음', () => {
  const csv = `아이템,급,가격,거래일,스타포스
"아케인셰이드 모자",21,"9억",2026-09-20,17
아케인셰이드 모자,21,10억,2026-09-25,17
아케인셰이드 모자,30,32억,2026-09-26,22
잘못된 줄,,,,`;
  const trades = loadTrades(csv);
  assert.equal(trades.length, 3);
  const g = groupByGrade(trades, { item: '아케인셰이드 모자' });
  assert.deepEqual(g.map((x) => x.grade), [30, 21]);
  assert.equal(g[1].median, 950_000_000);
  assert.equal(g[1].recent[0].price, 1_000_000_000); // 최신순
  const json = loadTrades(JSON.stringify({ trades: [{ item_name: 'A', grade: 3, price: 100 }] }));
  assert.equal(json[0].item, 'A');
});

test('아이템명 근사 매칭', () => {
  const items = ['아케인셰이드 모자', '앱솔랩스 신발'];
  assert.equal(matchItemName('아케인셰이드모자', items), '아케인셰이드 모자');
  assert.equal(matchItemName('앱솔랩스 신발 (+7)', items), '앱솔랩스 신발');
  assert.equal(matchItemName('전혀 다른 것', items), null);
  assert.equal(matchItemName('아케인세이드 모자', items), '아케인셰이드 모자'); // OCR 오타 1자
  assert.equal(matchItemName('아케인셰이드 나이트케이프', items), null);    // 같은 세트 다른 부위는 연결하지 않음
});

test('급-가격 모델과 적정가 판정', () => {
  const pts = [15, 18, 21, 24, 27, 30].map((g) => ({ grade: g, price: 1e8 * Math.exp(0.2 * g) }));
  const m = fitGradeModel(pts);
  assert.ok(Math.abs(m.b - 0.2) < 1e-9);
  assert.ok(m.r > 0.999);

  const trades = sampleTrades({ now: new Date('2026-09-27') });
  const est = estimatePrice(trades, { item: '아케인셰이드 망토', grade: 24 });
  assert.equal(est.method, 'model');
  assert.ok(est.low < est.expected && est.expected < est.high);
  assert.equal(judgePrice(est.expected, est).verdict, 'fair');
  assert.equal(judgePrice(est.low * 0.5, est).verdict, 'cheap');
  assert.equal(judgePrice(est.high * 2, est).verdict, 'expensive');
  assert.equal(judgePrice(1e8, { expected: NaN }).verdict, 'unknown');
});
