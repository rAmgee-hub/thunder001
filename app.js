import { formatMeso, parseMeso } from './src/core/meso.js';
import { computeGrade, STAT_LABELS, parsePotentialLines } from './src/core/potential.js';
import { parseItemText } from './src/core/itemText.js';
import { loadTrades, groupByGrade, listItems, matchItemName, filterTrades } from './src/core/trades.js';
import { fitGradeModel, estimatePrice, judgePrice } from './src/core/pricing.js';
import { NexonClient, mapEquipment, mainStatOf, valueEquipment } from './src/core/nexon.js';
import { sampleTrades } from './src/core/sample.js';
import { flattenCharacterList, mainWorld, buildRoster, summarizeUnion, summarizeLinkSkills } from './src/core/roster.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (d) => (d ? `${d.getMonth() + 1}/${d.getDate()}` : '');
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* 저장 불가 환경 */ } },
};

let trades = sampleTrades();
let isSample = true;

// ---------- 공통: 데이터 ----------
function refreshData() {
  $('dataBadge').textContent = isSample ? '샘플(가상)' : '실제 데이터';
  $('dataBadge').classList.toggle('real', !isSample);
  const items = listItems(trades);
  $('dataInfo').textContent = `거래 ${trades.length.toLocaleString('ko-KR')}건 · 아이템 ${items.length}종`;
  for (const sel of [$('gItem'), $('jItem')]) {
    const prev = sel.value;
    sel.innerHTML = items.map((i) => `<option value="${esc(i.item)}">${esc(i.item)} (${i.count})</option>`).join('');
    if (items.some((i) => i.item === prev)) sel.value = prev;
  }
  const sfs = [...new Set(trades.map((t) => t.starforce).filter((v) => v != null))].sort((a, b) => a - b);
  $('gSf').innerHTML = '<option value="">전체</option>' + sfs.map((s) => `<option value="${s}">${s}성</option>`).join('');
  renderGrade();
  renderJudge();
}

$('tradeFile').addEventListener('change', async (e) => {
  const f = e.target.files?.[0];
  if (!f) return;
  try {
    const loaded = loadTrades(await f.text());
    if (!loaded.length) throw new Error('읽을 수 있는 거래가 없어요. 아이템/급/가격 열이 있는지 확인하세요.');
    trades = loaded;
    isSample = false;
    // ---------- 4. 육성 현황판 ----------
const ROLE_LABEL = { deal: '딜', surv: '생존', farm: '사냥·성장', stat: '스탯' };
let rosterChars = [];
let rosterExtra = new Map(); // world → { union, links, main }

function apiClient() {
  const key = $('cKey').value.trim();
  if (!proxy.proxy && !key) throw new Error('API 키를 "내 캐릭터 장비 가치" 탭에 입력하세요.');
  return new NexonClient({ apiKey: key || undefined, baseUrl: proxy.proxy ? 'api/nexon' : undefined });
}

function apiErrorText(err) {
  if (err instanceof TypeError && /fetch|network|load failed/i.test(err.message)) {
    return '브라우저에서 넥슨 서버에 직접 연결하지 못했어요. 터미널에서 "node server.js"로 실행한 뒤 http://localhost:8787 에서 다시 시도하세요.';
  }
  return err.message;
}

async function loadWorldExtra(world) {
  if (rosterExtra.has(world)) return rosterExtra.get(world);
  // 유니온은 월드 단위라 그 월드 최고 레벨 캐릭터 하나로 조회한다
  const main = rosterChars.filter((c) => c.world === world).sort((a, b) => b.level - a.level)[0];
  const extra = { main, union: null, links: [], errors: [] };
  if (main) {
    const client = apiClient();
    const [u, r, l] = await Promise.allSettled([client.union(main.ocid), client.unionRaider(main.ocid), client.linkSkill(main.ocid)]);
    extra.union = summarizeUnion(u.value, r.value);
    extra.links = l.status === 'fulfilled' ? summarizeLinkSkills(l.value) : [];
    extra.errors = [u, r, l].filter((x) => x.status === 'rejected').map((x) => x.reason.message);
  }
  rosterExtra.set(world, extra);
  return extra;
}

async function renderRoster() {
  const world = $('rWorld').value;
  const roster = buildRoster(rosterChars, { world });
  const s = roster.summary;
  const extra = await loadWorldExtra(world).catch((e) => ({ union: null, links: [], errors: [e.message] }));

  $('rOwned').textContent = `${s.owned} / ${s.total}`;
  $('rLevels').textContent = s.levelSum.toLocaleString('ko-KR');
  $('rUnion').textContent = extra.union?.level ? `Lv.${extra.union.level.toLocaleString('ko-KR')}` : '-';
  $('rSss').textContent = s.sss.length ? `${s.sss.length}명` : '0명';
  $('rSss').title = s.sss.join(', ');
  $('r285').textContent = `${s.lv285}개`;

  const f = $('rFilter').value;
  const show = (r) => f === 'all' || (f === 'owned' && r.character) || (f === 'todo' && !r.character)
    || (f === 'deal' && r.role === 'deal') || (f === 'up' && r.level >= 200 && r.level < 250);
  let last = null;
  const rows = [];
  for (const r of roster.rows.filter(show)) {
    if (r.group !== last) { last = r.group; rows.push(`<tr class="grp"><td colspan="7">${esc(r.group)}</td></tr>`); }
    rows.push(`<tr class="${r.character ? '' : 'dim'}">
      <td><b>${esc(r.job)}</b></td>
      <td>${esc(r.character?.name ?? '')}</td>
      <td class="num">${r.level ?? '—'}</td>
      <td>${r.rank ? `<span class="rank ${r.rank}">${r.rank}</span>` : '<span class="rank">미육성</span>'}</td>
      <td>${esc(r.union)}<br><span class="hint">${esc(r.unionValues)}</span></td>
      <td>${esc(r.link ?? '이름 확인 필요')}</td>
      <td><span class="role ${r.role}">${ROLE_LABEL[r.role]}</span></td>
    </tr>`);
  }
  $('rBody').innerHTML = rows.join('') || '<tr><td colspan="7" class="hint">조건에 맞는 직업이 없어요.</td></tr>';

  $('rLinks').innerHTML = roster.links.map((l) => {
    const cls = l.owned >= l.total ? 'yes' : l.owned ? 'part' : '';
    const text = l.total === 1 ? (l.owned ? '확보' : '미보유') : `${l.owned}/${l.total}`;
    return `<tr class="${l.owned ? '' : 'dim'}"><td><b>${esc(l.link)}</b></td><td>${esc(l.jobs.join(', '))}</td><td class="num ${cls}">${text}</td></tr>`;
  }).join('');

  const eff = [...(extra.union?.raiderEffects ?? []), ...(extra.union?.occupiedEffects ?? [])];
  $('rRaider').innerHTML = eff.length ? eff.map((e) => `<li>${esc(e)}</li>`).join('') : '<li class="hint">정보 없음</li>';
  $('rLinkTitle').textContent = extra.main ? `장착 링크 스킬 (${extra.main.name})` : '장착 링크 스킬';
  $('rEquipped').innerHTML = extra.links.length
    ? extra.links.map((l) => `<li><b>${esc(l.name)}</b> Lv.${l.level ?? '?'} <span class="hint">${esc(l.effect)}</span></li>`).join('')
    : '<li class="hint">정보 없음</li>';

  const notes = [];
  if (roster.unknown.length) notes.push(`참조표에 없는 직업: ${roster.unknown.map((c) => `${c.name}(${c.job} ${c.level})`).join(', ')}`);
  if (extra.errors?.length) notes.push(`일부 정보를 못 불러왔어요: ${extra.errors.join(' / ')}`);
  $('rUnknown').textContent = notes.join(' · ');
  $('rResult').hidden = false;
}

$('rLoad').addEventListener('click', async () => {
  const status = $('rStatus');
  status.classList.remove('err');
  status.textContent = '계정 캐릭터 목록을 불러오는 중…';
  try {
    rosterChars = flattenCharacterList(await apiClient().characterList());
    rosterExtra = new Map();
    if (!rosterChars.length) throw new Error('이 키의 계정에서 캐릭터를 찾지 못했어요.');
    const worlds = [...new Set(rosterChars.map((c) => c.world))];
    const main = mainWorld(rosterChars);
    $('rWorld').innerHTML = worlds.map((w) => `<option${w === main ? ' selected' : ''}>${esc(w)}</option>`).join('');
    $('rWorld').disabled = false;
    await renderRoster();
    status.textContent = `캐릭터 ${rosterChars.length}명을 불러왔어요 (${new Date().toLocaleString('ko-KR')}).`;
  } catch (err) {
    status.textContent = apiErrorText(err);
    status.classList.add('err');
  }
});
$('rWorld').addEventListener('change', renderRoster);
$('rFilter').addEventListener('change', () => { if (rosterChars.length) renderRoster(); });

refreshData();
  } catch (err) {
    alert(`불러오기 실패: ${err.message}`);
  }
  e.target.value = '';
});

// ---------- 탭 ----------
document.querySelectorAll('[role="tab"]').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('[role="tab"]').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
    document.querySelectorAll('.panel').forEach((p) => { p.hidden = p.id !== `tab-${btn.dataset.tab}`; });
    store.set('maple.tab', btn.dataset.tab);
  });
});
const savedTab = store.get('maple.tab');
if (savedTab) document.querySelector(`[data-tab="${savedTab}"]`)?.click();

// ---------- 1. 급별 최근 거래 ----------
function renderGrade() {
  const item = $('gItem').value;
  const days = Number($('gDays').value);
  const sf = $('gSf').value === '' ? null : Number($('gSf').value);
  const since = days ? new Date(Date.now() - days * 864e5) : null;
  const groups = groupByGrade(trades, { item, since, starforce: sf, recent: 3 });

  const pool = filterTrades(trades, { item, since, starforce: sf });
  const model = fitGradeModel(pool);
  $('gModel').textContent = model
    ? `급이 1 오르면 가격이 평균 ${((Math.exp(model.b) - 1) * 100).toFixed(1)}% 올라요 · 급-가격 상관계수 ${model.r.toFixed(2)} · 거래 ${model.n}건 기준`
    : '';

  const lo = Math.min(...groups.map((g) => g.min));
  const hi = Math.max(...groups.map((g) => g.max));
  const pos = (v) => (hi > lo ? ((Math.log(v) - Math.log(lo)) / (Math.log(hi) - Math.log(lo))) * 100 : 50);

  $('gBody').innerHTML = groups.map((g) => `
    <tr>
      <td class="num">${g.grade}급</td>
      <td class="num">${g.count}</td>
      <td class="num">${formatMeso(g.median)}</td>
      <td><div class="range">
        <div class="bar" title="최저 ${formatMeso(g.min)} ~ 최고 ${formatMeso(g.max)}">
          <i style="left:${pos(g.min)}%;right:${100 - pos(g.max)}%"></i><b style="left:calc(${pos(g.median)}% - 1px)"></b>
        </div>
        <small>${formatMeso(g.min)} ~ ${formatMeso(g.max)}</small>
      </div></td>
      <td class="recent">${g.recent.map((t) => `${fmtDate(t.date)} ${formatMeso(t.price)}${t.starforce != null ? ` (${t.starforce}성)` : ''}`).map(esc).join('<br>')}</td>
    </tr>`).join('');
  $('gEmpty').hidden = groups.length > 0;
}
['gItem', 'gDays', 'gSf'].forEach((id) => $(id).addEventListener('change', renderGrade));

// ---------- 2. 가격 적정성 ----------
let tesseractLoading = null;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  tesseractLoading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
    s.onload = () => resolve(window.Tesseract);
    s.onerror = () => { tesseractLoading = null; reject(new Error('글자 인식 엔진을 불러오지 못했어요 (인터넷 연결 확인)')); };
    document.head.appendChild(s);
  });
  return tesseractLoading;
}

async function runOCR(file) {
  const status = $('ocrStatus');
  status.classList.remove('err');
  const img = $('preview');
  img.src = URL.createObjectURL(file);
  img.hidden = false;
  try {
    status.textContent = '글자 인식 엔진 준비 중… (처음 한 번은 수십 초 걸려요)';
    const T = await loadTesseract();
    const { data } = await T.recognize(file, 'kor+eng', {
      logger: (m) => { if (m.status === 'recognizing text') status.textContent = `글자 인식 중… ${Math.round(m.progress * 100)}%`; },
    });
    $('itemText').value = data.text.trim();
    status.textContent = '인식 완료. 틀린 글자가 있으면 아래 텍스트를 고치면 바로 다시 계산돼요.';
    renderJudge(true);
  } catch (err) {
    status.textContent = err.message;
    status.classList.add('err');
  }
}

const drop = $('drop');
drop.addEventListener('click', () => $('imgFile').click());
drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('imgFile').click(); } });
$('imgFile').addEventListener('change', (e) => { const f = e.target.files?.[0]; if (f) runOCR(f); e.target.value = ''; });
drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
drop.addEventListener('dragleave', () => drop.classList.remove('over'));
drop.addEventListener('drop', (e) => {
  e.preventDefault(); drop.classList.remove('over');
  const f = [...(e.dataTransfer?.files ?? [])].find((x) => x.type.startsWith('image/'));
  if (f) runOCR(f);
});
document.addEventListener('paste', (e) => {
  if ($('tab-judge').hidden) return;
  const f = [...(e.clipboardData?.files ?? [])].find((x) => x.type.startsWith('image/'));
  if (f) { e.preventDefault(); runOCR(f); }
});

function renderJudge(autoMatch = false) {
  const text = $('itemText').value;
  const item = parseItemText(text);
  const lines = parsePotentialLines(item.potential);
  const main = $('jMain').value || undefined;
  const { grade, mainStat, breakdown } = computeGrade(lines, { mainStat: main });

  if (autoMatch && item.name) {
    const m = matchItemName(item.name, listItems(trades).map((i) => i.item));
    if (m) $('jItem').value = m;
  }

  $('parsed').innerHTML = text.trim() ? `
    <h3>${esc(item.name ?? '아이템명 인식 안 됨')}</h3>
    <dl>
      <dt>스타포스</dt><dd>${item.starforce != null ? `${item.starforce}성` : '-'}</dd>
      <dt>잠재</dt><dd>${esc(item.potentialGrade ?? '-')} · ${item.potential.map(esc).join(' / ') || '옵션 없음'}</dd>
      <dt>에디셔널</dt><dd>${esc(item.additionalGrade ?? '-')} · ${item.additional.map(esc).join(' / ') || '옵션 없음'}</dd>
      <dt>급</dt><dd><b>${grade}급</b> (${mainStat}${breakdown.length ? ` · ${breakdown.map((b) => `${STAT_LABELS[b.stat]} ${b.contrib}`).join(' + ')}` : ''})</dd>
    </dl>
    ${item.guessedSections ? '<p class="hint">잠재/에디 구분 제목을 못 읽어서 옵션 줄 순서로 추정했어요.</p>' : ''}`
    : '<p class="hint">스크린샷을 넣거나 툴팁 텍스트를 붙여넣으면 급을 계산해요.</p>';

  const v = $('verdict');
  v.className = 'card verdict';
  const itemName = $('jItem').value;
  if (!text.trim() || !itemName) { v.innerHTML = ''; return; }

  const est = estimatePrice(trades, { item: itemName, grade, starforce: item.starforce });
  const ask = parseMeso($('jPrice').value);
  const basis = est.method === 'model'
    ? `${est.sfMatched ? `${item.starforce}성 ` : ''}거래 ${est.sample}건의 급-가격 관계로 계산${est.extrapolated ? ' · 거래 기록 범위 밖 급이라 오차가 커요' : ''}`
    : est.method === 'median' ? `같은 급 거래 ${est.sample}건의 중앙값` : '';

  if (!Number.isFinite(est.expected)) {
    v.innerHTML = `<p class="big">판정 불가</p><p>${esc(itemName)} 거래 기록이 부족해요.</p>`;
    return;
  }
  const head = `<p>${esc(itemName)} ${grade}급 예상 시세 <b>${formatMeso(est.expected)}</b> (보통 ${formatMeso(est.low)} ~ ${formatMeso(est.high)})</p><p class="hint">${esc(basis)}</p>`;
  if (!(ask > 0)) { v.innerHTML = `<p class="big">판매가를 입력하세요</p>${head}`; return; }
  const j = judgePrice(ask, est);
  v.classList.add(j.verdict);
  v.innerHTML = `<p class="big">${{ cheap: '저렴해요', fair: '적정해요', expensive: '비싸요', unknown: '판정 불가' }[j.verdict]}</p>
    <p>${esc(j.label)}</p>${head}`;
}
$('itemText').addEventListener('input', () => renderJudge(true));
['jItem', 'jMain'].forEach((id) => $(id).addEventListener('change', () => renderJudge()));
$('jPrice').addEventListener('input', () => renderJudge());

// ---------- 3. 내 캐릭터 장비 가치 ----------
let proxy = { proxy: false, hasKey: false };
fetch('api/health').then((r) => (r.ok ? r.json() : null)).then((h) => {
  if (h?.proxy) proxy = h;
}).catch(() => {}).finally(() => {
  $('cHint').textContent = proxy.proxy
    ? (proxy.hasKey ? '로컬 서버에 API 키가 설정돼 있어요. 키 입력 없이 불러올 수 있어요.' : '로컬 서버로 실행 중이에요. .env에 NEXON_API_KEY를 넣거나 여기에 키를 입력하세요.')
    : 'API 키는 openapi.nexon.com에서 무료로 발급받을 수 있어요. 키는 넥슨 서버로만 전송돼요.';
});
const savedKey = store.get('maple.nexonKey');
if (savedKey) { $('cKey').value = savedKey; $('cRemember').checked = true; }
const savedName = store.get('maple.charName');
if (savedName) $('cName').value = savedName;

$('charForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('cName').value.trim();
  const key = $('cKey').value.trim();
  store.set('maple.nexonKey', $('cRemember').checked && key ? key : null);
  store.set('maple.charName', name);
  const status = $('cStatus');
  status.classList.remove('err');
  status.textContent = '불러오는 중…';
  $('cResult').hidden = true;

  if (!proxy.proxy && !key) {
    status.textContent = 'API 키를 입력하세요.';
    status.classList.add('err');
    return;
  }
  const client = new NexonClient({ apiKey: key || undefined, baseUrl: proxy.proxy ? 'api/nexon' : undefined });
  try {
    const { basic, equipment } = await client.character(name);
    const main = mainStatOf(basic.character_class);
    const items = mapEquipment(equipment);
    const v = valueEquipment(items, trades, { mainStat: main ?? undefined });

    $('cWho').textContent = `${basic.character_name} · Lv.${basic.character_level} ${basic.character_class}`;
    $('cTotal').textContent = v.pricedCount ? formatMeso(v.total) : '-';
    $('cCount').textContent = `${v.pricedCount} / ${v.items.length}`;
    $('cBody').innerHTML = v.items.map((it) => `
      <tr>
        <td>${esc(it.slot)}</td>
        <td>${esc(it.name)}${it.matchedItem && it.matchedItem !== it.name ? `<br><span class="hint">시세 비교: ${esc(it.matchedItem)}</span>` : ''}</td>
        <td class="num">${it.starforce ?? '-'}</td>
        <td>${esc(it.potentialGrade ?? '-')}<br><span class="hint">${it.potential.map(esc).join(' / ')}</span></td>
        <td class="num">${it.potential.length ? `${it.grade}급` : '-'}</td>
        <td class="num">${Number.isFinite(it.estimate.expected) ? formatMeso(it.estimate.expected) : '-'}</td>
      </tr>`).join('');
    $('cResult').hidden = false;
    status.textContent = isSample ? '주의: 지금은 샘플(가상) 거래 데이터로 계산한 값이에요. 실제 거래 파일을 불러오면 정확해져요.' : '';
  } catch (err) {
    const cors = err instanceof TypeError && /fetch|network|load failed/i.test(err.message);
    status.textContent = cors
      ? '브라우저에서 넥슨 서버에 직접 연결하지 못했어요. 터미널에서 "node server.js"로 실행한 뒤 http://localhost:8787 에서 다시 시도하세요.'
      : err.message;
    status.classList.add('err');
  }
});

// ---------- 4. 육성 현황판 ----------
const ROLE_LABEL = { deal: '딜', surv: '생존', farm: '사냥·성장', stat: '스탯' };
let rosterChars = [];
let rosterExtra = new Map(); // world → { union, links, main }

function apiClient() {
  const key = $('cKey').value.trim();
  if (!proxy.proxy && !key) throw new Error('API 키를 "내 캐릭터 장비 가치" 탭에 입력하세요.');
  return new NexonClient({ apiKey: key || undefined, baseUrl: proxy.proxy ? 'api/nexon' : undefined });
}

function apiErrorText(err) {
  if (err instanceof TypeError && /fetch|network|load failed/i.test(err.message)) {
    return '브라우저에서 넥슨 서버에 직접 연결하지 못했어요. 터미널에서 "node server.js"로 실행한 뒤 http://localhost:8787 에서 다시 시도하세요.';
  }
  return err.message;
}

async function loadWorldExtra(world) {
  if (rosterExtra.has(world)) return rosterExtra.get(world);
  // 유니온은 월드 단위라 그 월드 최고 레벨 캐릭터 하나로 조회한다
  const main = rosterChars.filter((c) => c.world === world).sort((a, b) => b.level - a.level)[0];
  const extra = { main, union: null, links: [], errors: [] };
  if (main) {
    const client = apiClient();
    const [u, r, l] = await Promise.allSettled([client.union(main.ocid), client.unionRaider(main.ocid), client.linkSkill(main.ocid)]);
    extra.union = summarizeUnion(u.value, r.value);
    extra.links = l.status === 'fulfilled' ? summarizeLinkSkills(l.value) : [];
    extra.errors = [u, r, l].filter((x) => x.status === 'rejected').map((x) => x.reason.message);
  }
  rosterExtra.set(world, extra);
  return extra;
}

async function renderRoster() {
  const world = $('rWorld').value;
  const roster = buildRoster(rosterChars, { world });
  const s = roster.summary;
  const extra = await loadWorldExtra(world).catch((e) => ({ union: null, links: [], errors: [e.message] }));

  $('rOwned').textContent = `${s.owned} / ${s.total}`;
  $('rLevels').textContent = s.levelSum.toLocaleString('ko-KR');
  $('rUnion').textContent = extra.union?.level ? `Lv.${extra.union.level.toLocaleString('ko-KR')}` : '-';
  $('rSss').textContent = s.sss.length ? `${s.sss.length}명` : '0명';
  $('rSss').title = s.sss.join(', ');
  $('r285').textContent = `${s.lv285}개`;

  const f = $('rFilter').value;
  const show = (r) => f === 'all' || (f === 'owned' && r.character) || (f === 'todo' && !r.character)
    || (f === 'deal' && r.role === 'deal') || (f === 'up' && r.level >= 200 && r.level < 250);
  let last = null;
  const rows = [];
  for (const r of roster.rows.filter(show)) {
    if (r.group !== last) { last = r.group; rows.push(`<tr class="grp"><td colspan="7">${esc(r.group)}</td></tr>`); }
    rows.push(`<tr class="${r.character ? '' : 'dim'}">
      <td><b>${esc(r.job)}</b></td>
      <td>${esc(r.character?.name ?? '')}</td>
      <td class="num">${r.level ?? '—'}</td>
      <td>${r.rank ? `<span class="rank ${r.rank}">${r.rank}</span>` : '<span class="rank">미육성</span>'}</td>
      <td>${esc(r.union)}<br><span class="hint">${esc(r.unionValues)}</span></td>
      <td>${esc(r.link ?? '이름 확인 필요')}</td>
      <td><span class="role ${r.role}">${ROLE_LABEL[r.role]}</span></td>
    </tr>`);
  }
  $('rBody').innerHTML = rows.join('') || '<tr><td colspan="7" class="hint">조건에 맞는 직업이 없어요.</td></tr>';

  $('rLinks').innerHTML = roster.links.map((l) => {
    const cls = l.owned >= l.total ? 'yes' : l.owned ? 'part' : '';
    const text = l.total === 1 ? (l.owned ? '확보' : '미보유') : `${l.owned}/${l.total}`;
    return `<tr class="${l.owned ? '' : 'dim'}"><td><b>${esc(l.link)}</b></td><td>${esc(l.jobs.join(', '))}</td><td class="num ${cls}">${text}</td></tr>`;
  }).join('');

  const eff = [...(extra.union?.raiderEffects ?? []), ...(extra.union?.occupiedEffects ?? [])];
  $('rRaider').innerHTML = eff.length ? eff.map((e) => `<li>${esc(e)}</li>`).join('') : '<li class="hint">정보 없음</li>';
  $('rLinkTitle').textContent = extra.main ? `장착 링크 스킬 (${extra.main.name})` : '장착 링크 스킬';
  $('rEquipped').innerHTML = extra.links.length
    ? extra.links.map((l) => `<li><b>${esc(l.name)}</b> Lv.${l.level ?? '?'} <span class="hint">${esc(l.effect)}</span></li>`).join('')
    : '<li class="hint">정보 없음</li>';

  const notes = [];
  if (roster.unknown.length) notes.push(`참조표에 없는 직업: ${roster.unknown.map((c) => `${c.name}(${c.job} ${c.level})`).join(', ')}`);
  if (extra.errors?.length) notes.push(`일부 정보를 못 불러왔어요: ${extra.errors.join(' / ')}`);
  $('rUnknown').textContent = notes.join(' · ');
  $('rResult').hidden = false;
}

$('rLoad').addEventListener('click', async () => {
  const status = $('rStatus');
  status.classList.remove('err');
  status.textContent = '계정 캐릭터 목록을 불러오는 중…';
  try {
    rosterChars = flattenCharacterList(await apiClient().characterList());
    rosterExtra = new Map();
    if (!rosterChars.length) throw new Error('이 키의 계정에서 캐릭터를 찾지 못했어요.');
    const worlds = [...new Set(rosterChars.map((c) => c.world))];
    const main = mainWorld(rosterChars);
    $('rWorld').innerHTML = worlds.map((w) => `<option${w === main ? ' selected' : ''}>${esc(w)}</option>`).join('');
    $('rWorld').disabled = false;
    await renderRoster();
    status.textContent = `캐릭터 ${rosterChars.length}명을 불러왔어요 (${new Date().toLocaleString('ko-KR')}).`;
  } catch (err) {
    status.textContent = apiErrorText(err);
    status.classList.add('err');
  }
});
$('rWorld').addEventListener('change', renderRoster);
$('rFilter').addEventListener('change', () => { if (rosterChars.length) renderRoster(); });

refreshData();
