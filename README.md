# 메이플 시세 도구

메이플스토리 프로젝트에 바로 붙일 수 있도록 만든 **독립 모듈 + 웹 화면**입니다. 외부 라이브러리 없이 순수 JavaScript로 되어 있어요.

| 기능 | 하는 일 |
|---|---|
| 급별 최근 거래 | 아이템별로 급마다 거래 수, 중앙값, 가격 범위, 최근 거래 3건을 보여줘요. 급이 1 오를 때 가격이 몇 % 오르는지와 상관계수도 표시해요. |
| 가격 적정성 | 아이템 스크린샷을 넣으면 브라우저 안에서 글자를 인식해요(Tesseract.js). 인식한 텍스트로 스타포스, 잠재옵션, 급을 뽑고, 판매가가 저렴·적정·비싼지 판정해요. |
| 내 캐릭터 장비 가치 | 넥슨 Open API로 장착 장비를 불러와 장비마다 급과 예상 시세를 계산하고 합계를 내요. |
| 육성 현황판 | 내 넥슨 계정의 캐릭터 목록을 불러와 48직업의 보유 현황, 유니온 등급, 링크 스킬 확보 수를 월드별로 자동 정리해요. 유니온 레벨, 공격대원 효과, 장착 링크 스킬도 함께 보여줘요. |

## Windows에서 설치 (가장 쉬운 방법)

1. zip 파일의 압축을 원하는 곳에 풀어요. 예: `C:\AI\maple-tools`. 나중에 폴더를 옮기면 바로가기가 끊겨요.
2. 폴더 안의 **`install.bat`** 을 더블클릭해요.
3. 넥슨 API 키를 붙여넣고 Enter를 눌러요. 키는 폴더 안의 `.env` 파일에만 저장돼요.
4. 바탕화면에 **"메이플 시세 도구"** 아이콘이 생기고 브라우저가 열려요.

다음부터는 바탕화면 아이콘만 더블클릭하면 돼요. 검은 창을 닫으면 도구가 꺼져요. 키를 바꾸려면 `install.bat`을 다시 실행하세요. Node.js가 없으면 설치 파일이 자동 설치(winget)를 제안해요.

## 실행 (직접)

```bash
node server.js          # http://localhost:8787
npm test                # 모듈 테스트
```

- Node 20 이상이 필요해요. 설치할 패키지는 없어요.
- 넥슨 API 키는 프로젝트 폴더의 `.env` 파일에 `NEXON_API_KEY=발급받은키` 형태로 넣어요. `.gitignore`에 들어 있어서 GitHub에 올라가지 않아요.
- `index.html`만 GitHub Pages에 올려도 동작해요. 이때 캐릭터 조회는 각자 화면에 자기 키를 넣어서 써요.

## 거래 데이터 형식

처음 화면은 **가상 샘플 데이터**로 떠요. "거래 데이터 불러오기"로 CSV나 JSON을 넣으면 실제 데이터로 바뀌어요. 양식은 `data/trades-template.csv`에 있어요.

| 표준 키 | 인식하는 열 이름 | 필수 |
|---|---|---|
| item | item, item_name, name, 아이템, 아이템명 | ✅ |
| grade | grade, 급, 잠재급 | ✅ |
| price | price, meso, 가격, 거래가 (`12억 3000만`, `1.5억`, 숫자 모두 가능) | ✅ |
| date | date, traded_at, time, 거래일, 날짜 | |
| starforce | starforce, star, 스타포스, 성 | |
| server | server, world, 월드, 서버 | |

JSON은 `[{...}, ...]` 배열이나 `{ "trades": [...] }` 형태 모두 받아요.

## 기존 프로젝트에 붙이는 법

`src/core/`의 파일들은 화면과 분리되어 있어서 Node에서도 브라우저에서도 그대로 `import`할 수 있어요.

```js
import { loadTrades, groupByGrade } from './src/core/trades.js';
import { computeGrade } from './src/core/potential.js';
import { parseItemText } from './src/core/itemText.js';
import { estimatePrice, judgePrice } from './src/core/pricing.js';
import { NexonClient, mapEquipment, valueEquipment } from './src/core/nexon.js';

const trades = loadTrades(csvText);                       // 수집한 거래 데이터
groupByGrade(trades, { item: '아케인셰이드 모자', recent: 5 });

const item = parseItemText(ocrText);                      // 툴팁 텍스트 → 옵션
const { grade } = computeGrade(item.potential, { mainStat: 'STR' });
const est = estimatePrice(trades, { item: '아케인셰이드 모자', grade, starforce: item.starforce });
judgePrice(1_500_000_000, est);                           // { verdict: 'cheap' | 'fair' | 'expensive', label }

const api = new NexonClient({ apiKey: process.env.NEXON_API_KEY });
const { basic, equipment } = await api.character('캐릭터명');
valueEquipment(mapEquipment(equipment), trades);          // 장비별 급·시세·합계
```

기존 프로젝트가 Python이면 `pricing.js`(로그-선형 회귀)와 `potential.js`(급 계산)가 짧아서 그대로 옮기기 쉬워요. 거래 수집 결과를 위 CSV 양식으로 내보내기만 해도 화면을 바로 쓸 수 있어요.

## 사용하는 넥슨 API

| API | 쓰는 곳 |
|---|---|
| `/id`, `/character/basic`, `/character/item-equipment` | 장비 가치 |
| `/character/list` | 육성 현황판. 키를 발급한 **본인 계정**의 캐릭터만 조회돼요. |
| `/user/union`, `/user/union-raider` | 육성 현황판의 유니온 레벨과 공격대원 효과. 월드 최고 레벨 캐릭터로 조회해요. |
| `/character/link-skill` | 육성 현황판의 장착 링크 스킬 |

## 계산 기준

- **급**: 윗잠의 주스탯% + 올스탯%를 더해요. 데몬 어벤져는 최대 HP%만 세고, 제논은 STR/DEX/LUK% 각각을 1/3로 쳐요. 크뎀·쿨감·렙당 주스탯은 기본값이 0이고 `weights` 옵션으로 환산 비율을 바꿀 수 있어요.
- **예상 시세**: 같은 아이템 거래로 `ln(가격) = a + b × 급` 회귀를 만들어요. 같은 스타포스 거래가 10건 이상이면 그것만 써요. 거래가 5건 미만이면 같은 급 거래의 중앙값을 써요.
- **판정**: 회귀 오차 ±1σ(보통 거래의 약 68%) 범위 안이면 적정, 아래면 저렴, 위면 비싸다고 판정해요.
- **육성 현황판**: 같은 직업이 여러 명이면 최고 레벨 캐릭터를 대표로 써요(유니온도 직업당 1명만 효과가 있어요). 링크 스킬은 70레벨 이상일 때 확보로 세요. 직업별 공격대원 효과와 링크 스킬 이름은 `src/core/roster.js`의 참조표에 있어요.
- **이름 매칭**: 캐릭터 장비나 스크린샷의 아이템명은 거래 데이터 이름과 정확히 일치하거나, 포함 관계이거나, 오타 1~2자 수준으로 비슷할 때만 연결해요. 같은 세트의 다른 부위는 연결하지 않아요.

## 알려진 한계

- 스크린샷 글자 인식은 게임 글꼴 때문에 틀릴 수 있어요. 인식된 텍스트를 화면에서 고치면 바로 다시 계산돼요.
- 넥슨 Open API 연동은 공식 응답 형식을 기준으로 만들었고, 개발 환경에서는 넥슨 서버에 접속할 수 없어서 예시 응답으로만 테스트했어요. 브라우저에서 직접 호출이 막히면 `node server.js`로 실행하세요. 서버가 대신 호출해 줘요.
