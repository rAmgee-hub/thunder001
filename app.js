import { formatMeso, parseMeso } from './src/core/meso.js';
import { computeGrade, STAT_LABELS, parsePotentialLines } from './src/core/potential.js';
import { parseItemText } from './src/core/itemText.js';
import { loadTrades, groupByGrade, listItems, matchItemName, filterTrades } from './src/core/trades.js';
import { fitGradeModel, estimatePrice, judgePrice } from './src/core/pricing.js';
import { NexonClient, mapEquipment, mainStatOf, valueEquipment } from './src/core/nexon.js';
import { sampleTrades } from './src/core/sample.js';

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

refreshData();
