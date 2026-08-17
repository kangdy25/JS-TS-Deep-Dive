# 📌 Chapter 2: 성능 분석 도구 마스터하기 (DevTools & Lighthouse)

성능 도구는 점수를 올려 주는 버튼이 아니라 **원인에 대한 증거를 수집하는 도구**입니다. 같은 URL이라도 로그인 상태, 캐시, 실험 플래그, 네트워크, 기기 성능, 사용자가 밟는 흐름에 따라 결과가 달라집니다. 먼저 측정 조건을 고정하고, DevTools Trace로 병목을 찾은 뒤, 같은 조건에서 다시 검증해야 합니다.

이 장의 Lighthouse와 DevTools 결과는 Lab Data입니다. 실제 사용자 P75와 RUM·CrUX를 해석하는 방법은 [Chapter 7](./chapter-7-web-vitals-measurement.md), LCP·INP·CLS의 상세 진단은 [Chapter 8](./chapter-8-core-web-vitals.md)에서 다룹니다.

---

## 1. 측정 전에 "계약"을 먼저 만든다

### 1) 재현 가능한 측정 기록

성능 회귀를 비교하려면 실행할 때마다 같은 상황을 최대한 재현해야 합니다. 아래 항목을 이슈·PR·성능 노트에 함께 남깁니다.

| 항목 | 기록 예시 | 왜 필요한가 |
| :--- | :--- | :--- |
| URL·배포 버전 | `/products/42`, `release-2026.08.17` | 서로 다른 템플릿·번들을 비교하는 실수를 막음 |
| 사용자 상태 | 비로그인 / 로그인 / 장바구니 20개 | 개인화·권한·API 응답이 렌더링을 바꿀 수 있음 |
| 시나리오 | cold load → 필터 열기 → 정렬 → 첫 카드 클릭 | 같은 상호작용을 반복할 수 있음 |
| 캐시 상태 | Disable cache 여부, hard reload 여부 | 새 방문과 재방문의 전송량이 다름 |
| 네트워크·CPU | preset 이름 또는 custom throttle 값 | 느린 조건에서만 드러나는 병목을 비교 |
| 브라우저·기기 | Chrome 버전, 데스크톱 또는 실제 Android 기기 | 엔진·하드웨어·화면 주사율 차이를 설명 |

CPU throttling의 `4x`, `6x` 같은 값은 **현재 개발 PC를 기준으로 한 상대적 감속**입니다. 모바일 CPU를 정확히 복제하지 않으므로, 추세 비교에는 유용하지만 "이 값이면 모든 모바일 사용자"라는 뜻으로 해석하면 안 됩니다. 대표 실제 기기와 Field Data를 함께 사용합니다.

### 2) 문제를 문장으로 좁히기

"페이지가 느리다" 대신 다음처럼 관찰 가능한 문장을 만듭니다.

* "로그아웃 cold load에서 Hero 이미지가 보이기 전에 Main Thread가 1.2초 동안 bootstrap을 실행한다."
* "상품 500개에서 정렬 버튼을 누르면 다음 Paint 전까지 긴 JavaScript 작업이 생긴다."
* "웹 폰트가 캐시되지 않은 상태에서 제목 줄바꿈이 바뀌며 카드가 아래로 이동한다."

문장이 정해지면 어떤 Trace를 찍을지 결정할 수 있습니다. 첫 번째는 **load recording**, 두 번째는 **runtime recording**, 세 번째는 Layout Shift와 Network를 함께 보는 녹화가 필요합니다.

---

## 2. Chrome DevTools Performance 패널 읽기

### 1) Live Metrics로 가설을 세운 뒤 Trace를 남기기

현재 Performance 패널의 Live Metrics 화면은 로컬 LCP·INP·CLS와 상호작용·Layout Shift의 변화를 빠르게 확인하는 데 유용합니다. 특정 클릭이나 화면 전환에서 문제가 반복되는지 먼저 관찰한 뒤, **같은 동작을 Trace로 녹화**해 원인을 추적합니다.

| 녹화 종류 | 사용할 때 | 기본 절차 |
| :--- | :--- | :--- |
| Load performance | 첫 HTML부터 첫 화면까지 느릴 때 | Performance → Record and reload → Screenshots 포함 → 끝난 뒤 LCP·Network 확인 |
| Runtime performance | 클릭·스크롤·입력 뒤 버벅일 때 | Record → 문제 동작 1회 재현 → Stop → Interaction과 Main 확인 |

가능하면 한 Trace에는 한 가지 시나리오만 넣습니다. 여러 클릭을 한 번에 기록하면 어떤 작업이 어느 상호작용의 결과인지 분리하기 어려워집니다. 화면 캡처(Screenshots)를 켜면 "숫자는 끝났지만 화면은 아직 안 바뀐" 구간도 확인할 수 있습니다.

### 2) Main Thread와 Flame Chart의 읽는 순서

Trace를 열면 긴 막대부터 보지 말고, 문제 시점의 프레임과 상호작용을 먼저 고릅니다.

1. **Timeline overview와 Screenshots**에서 사용자가 체감한 지점(빈 화면, 멈춤, 이동)을 찾습니다.
2. **Interaction track**이 있다면 클릭·탭·키 입력을 선택하고 input delay, processing duration, presentation delay 중 긴 구간을 구분합니다.
3. **Main track**에서 그 시간대의 JavaScript, Recalculate Style, Layout, Paint를 펼칩니다.
4. 선택한 작업의 **Bottom-up**으로 비용이 큰 함수를 모으고, **Call tree**로 누가 호출했는지 거슬러 올라갑니다.
5. 수정 후에는 같은 조건·같은 동작으로 새 Trace를 찍어 해당 구간만 줄었는지 비교합니다.

50ms를 넘는 Main Thread 작업은 Long Task로 표시될 수 있어 좋은 출발점입니다. 그러나 Long Task가 없다고 INP가 좋다는 뜻은 아닙니다. 여러 짧은 작업, 늦은 Paint, 느린 특정 상호작용도 사용자가 기다리는 시간을 만들 수 있으므로 Interaction의 세 구간과 다음 화면 갱신을 함께 봅니다.

### 3) Interaction과 Layout Shift를 원인까지 연결하기

| Track / 패널 | 먼저 볼 것 | 다음 질문 |
| :--- | :--- | :--- |
| Interaction | input delay·processing·presentation 중 최장 구간 | 이벤트 핸들러, 동기 계산, Vue update, Paint 중 무엇이 긴가? |
| Layout shifts | shift 시점과 영향을 받은 노드 | 이미지·폰트·광고·비동기 렌더링·Hydration 중 무엇과 동시에 일어났는가? |
| Main | 긴 scripting·rendering·painting 블록 | 내 코드, 라이브러리, 서드파티 중 어디에서 시작됐는가? |
| Network | LCP 후보와 요청 시작 시점 | 리소스 발견, 서버 응답, 다운로드, 렌더 중 어디가 늦는가? |

Performance의 **Insights**는 LCP 요청 발견, INP 구간, 서드파티, 중복·레거시 JavaScript 같은 패턴을 Trace와 연결해 줍니다. Insight는 수정 명령이 아니라 조사 순서를 제안하는 신호입니다. "통과하지 못했다"는 항목도 실제 사용자 흐름과 코드를 대조한 뒤에만 수정 대상으로 확정합니다.

### 4) Rendering 작업은 색보다 이벤트 이름으로 확인하기

DevTools의 색상과 화면 구성은 버전에 따라 달라질 수 있습니다. 따라서 "보라색이면 항상 Reflow"처럼 외우기보다 Trace의 이벤트 이름과 지속 시간을 확인합니다.

* **Recalculate Style / Layout**이 길면 DOM 크기, 선택자, 읽기·쓰기 반복, 큰 컴포넌트 update를 확인합니다.
* **Paint / Raster**가 길면 큰 이미지, 그림자·필터, 넓은 영역의 시각 효과를 확인합니다.
* **Composite Layers**만으로 끝날 것으로 기대한 애니메이션도 실제 Paint가 발생하는지 확인합니다.

브라우저 렌더링 경로와 forced layout 방지 패턴은 [Chapter 1](./chapter-1-rendering-basic.md), frame budget·Worker·이벤트 제어는 [Chapter 5](./chapter-5-rendering-advanced.md)에서 이어집니다.

---

## 3. Network 패널과 Waterfall을 원인별로 해석하기

### 1) Network를 열 때 켤 열

Network 표에는 보통 `Initiator`, `Priority`, `Protocol`, `Size`, `Status`, `Timing` 열을 추가해 둡니다. 하나의 요청을 클릭한 뒤 Headers와 Timing 탭도 함께 봅니다.

| 신호 | 의미 | 확인할 행동 |
| :--- | :--- | :--- |
| Initiator | 누가 요청을 만들었는지 | HTML, CSS, JavaScript, preload 중 어떤 경로에서 늦게 발견됐는지 확인 |
| Priority | 브라우저의 상대적 요청 우선순위 | LCP 리소스와 낮은 가치 리소스가 경쟁하지 않는지 확인 |
| Protocol | h1·h2·h3 등 전송 프로토콜 | 다중화가 있어도 우선순위·서버·대역폭 병목은 남는지 확인 |
| Size | 전송 크기·인코딩·캐시 관련 정보 | encoded / transferred bytes, `Content-Encoding`, cache 여부 확인 |
| Timing | Queueing, 연결, TTFB, 다운로드의 분해 | 느린 구간이 서버·발견·연결·바이트 중 어디인지 분리 |

### 2) Waterfall의 긴 구간을 해석하는 법

* **Queueing / Stalled**: HTTP/1.1의 연결 수만이 원인은 아닙니다. 요청 우선순위, 브라우저 스케줄러, 연결 재사용, Service Worker, 대역폭 경쟁도 영향을 줄 수 있습니다. HTTP/2·HTTP/3를 쓴다고 모든 대기가 사라지지는 않습니다.
* **DNS / Initial connection / SSL**: 새 origin 연결 비용입니다. 정말 필요한 cross-origin에만 `preconnect`를 검토합니다. 너무 많은 사전 연결은 오히려 연결·CPU 자원을 낭비할 수 있습니다.
* **Waiting (TTFB)**: 요청을 보낸 뒤 첫 바이트까지의 시간입니다. origin 처리, 캐시 적중 여부, CDN 경로, 네트워크 왕복 시간을 분리해서 봅니다.
* **Content Download**: 전송한 바이트와 대역폭의 문제입니다. 무조건 포맷을 바꾸기 전에 실제 `transferred` 크기, 캐시, 이미지 표시 크기를 확인합니다.

리소스 발견과 우선순위 힌트의 선택 기준은 [Chapter 4](./chapter-4-loading-patterns.md), 압축·이미지·캐시 정책은 [Chapter 3](./chapter-3-network-caching.md)에서 다룹니다.

---

## 4. Lighthouse는 Lab 진단과 회귀 확인용이다

Lighthouse는 고정된 환경에서 페이지를 감사해 개선 후보를 빠르게 보여 주는 **Lab 도구**입니다. 렌더링 차단 리소스, 이미지 전달, JavaScript 작업, 접근성·권장 사항을 살펴보고 PR 전후의 회귀를 찾는 데 적합합니다.

> [!WARNING]
> Lighthouse의 한 번의 결과로 실제 서비스가 Core Web Vitals를 통과했다고 판정할 수 없습니다. 실제 사용자 기기·네트워크·행동을 반영한 P75와 URL별 Field Data는 [Chapter 7](./chapter-7-web-vitals-measurement.md)의 CrUX·RUM 흐름으로 확인합니다.

### 1) Lighthouse 결과를 쓸 때의 원칙

1. URL, 로그인 상태, cache, throttling, 브라우저 버전을 같이 기록합니다.
2. 한 번의 점수보다 같은 조건에서 반복했을 때의 추세와 큰 원인을 봅니다.
3. audit 또는 Insight의 절감 추정치는 가설입니다. 코드 변경 뒤 Trace·Network에서 실제 바이트와 작업 시간이 줄었는지 확인합니다.
4. 점수를 위해 사용자 흐름을 훼손하지 않습니다. 예를 들어 첫 화면 콘텐츠를 단순히 숨기거나 기능을 늦추는 것은 해결이 아닐 수 있습니다.

---

## 5. Coverage와 번들 분석은 여러 사용자 흐름으로 수행한다

### 1) Coverage의 올바른 사용 범위

Coverage는 **녹화 중 실행·사용된 범위**를 보여 줍니다. 초기 로드에서 빨갛게 보인 코드는 그 시나리오에서 쓰이지 않았다는 뜻이지, 서비스 전체에서 불필요하다는 뜻은 아닙니다.

```text
초기 로드 / 검색 / 상세 진입 / 로그인 / 관리자 화면 / 오류 상태
        └─ 각 흐름에서 Coverage와 Network를 따로 기록한다.
```

대형 JS/CSS가 여러 흐름에서 계속 미사용이라면 다음 순서로 검토합니다.

1. 실제 import 경로와 route entry를 확인합니다.
2. Tree-shaking을 막는 barrel import, side effect, 중복 의존성을 확인합니다.
3. route·기능·조건부 component 단위 분할이 초기 사용자 경험에 이득인지 판단합니다.
4. 분할 뒤 초기 chunk뿐 아니라 **추가 요청, 첫 클릭 지연, 캐시 재사용**까지 새 Trace로 비교합니다.

작은 파일을 너무 많이 분할하면 요청·파싱·의존성 조정 비용이 새로 생길 수 있습니다. Nuxt 4는 페이지 route를 동적으로 import해 기본적인 route-level code splitting을 제공하지만, 공통 chunk와 사용자의 다음 행동까지 고려해 검증해야 합니다.

### 2) Bundle report에서 확인할 질문

* 큰 의존성이 여러 chunk에 중복 포함되어 있지 않은가?
* 작은 기능 하나 때문에 무거운 locale·editor·chart 패키지를 초기 경로에서 가져오지 않는가?
* import 방식이 tree-shaking을 방해하지 않는가?
* gzip/Brotli 추정치뿐 아니라 실제 배포 후 Network의 전송 크기와 cache hit를 확인했는가?

특정 라이브러리를 이름만 보고 교체하지 않습니다. bundle report, 실제 사용 API 범위, 대체안의 기능·유지보수 비용을 함께 비교합니다.

---

## 6. Vue·Pinia 업데이트를 브라우저 Trace와 연결하기

Vue Devtools의 Component Inspector·Timeline·Performance profiling은 어떤 상태 변경이 어떤 컴포넌트 update로 이어지는지 찾는 데 유용합니다. Pinia Devtools에서는 action과 state mutation 순서를 보며 중복 요청·반복 mutation·예상치 못한 전역 갱신을 추적합니다.

개발 환경에서는 `app.config.performance`를 켜 Vue 전용 marker를 Chrome Performance 타임라인에 표시할 수 있습니다. 이 설정은 진단용이므로 production에 그대로 켜지지 않게 하고, Nuxt에서는 앱 생성 단계의 Vue 설정으로 관리합니다.

### 1) User Timing으로 도메인 작업에 이름 붙이기

브라우저 Trace에서 "익명 함수"만 보일 때는 `performance.mark()`와 `performance.measure()`로 사용자 행동의 경계를 표시합니다. 아래 예제는 Vue 컴포넌트의 필터 계산 구간을 표시합니다.

```vue
<template>
  <button type="button" @click="applyFilters">필터 적용</button>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const visibleProductIds = ref<number[]>([]);

function applyFilters() {
  performance.mark('product-filter:start');

  // 실제 서비스에서는 이 자리에 정렬·필터·state 갱신이 들어간다.
  visibleProductIds.value = Array.from({ length: 200 }, (_, index) => index);

  performance.mark('product-filter:end');
  performance.measure('product-filter', 'product-filter:start', 'product-filter:end');
  performance.clearMarks('product-filter:start');
  performance.clearMarks('product-filter:end');
}
</script>
```

이 marker가 길다고 해서 즉시 Worker로 옮기지는 않습니다. 먼저 계산량, 반응성 범위, 렌더링할 목록 수를 분리합니다. 큰 목록의 가상화, 안정적인 props, Pinia getter와 derived state의 캐시 범위는 [Chapter 6](./chapter-6-framework-tuning.md)에서 다룹니다.

### ✅ 성능 진단 체크리스트

* [ ] 비교 가능한 URL·시나리오·캐시·throttle·배포 버전을 남겼는가?
* [ ] 문제 행동 하나를 Runtime Trace에서 재현했는가?
* [ ] Long Task뿐 아니라 Interaction의 다음 Paint와 Layout Shift를 확인했는가?
* [ ] Network의 Initiator·Priority·Timing을 함께 확인했는가?
* [ ] Lighthouse를 Field P75 판정이 아닌 Lab 가설·회귀 도구로 사용했는가?
* [ ] Coverage를 여러 사용자 흐름에서 확인했는가?
* [ ] 코드 변경 뒤 같은 조건의 Trace와 실제 전송량으로 효과를 검증했는가?

### 📚 공식 참고 자료

* [Chrome DevTools Performance features reference](https://developer.chrome.com/docs/devtools/performance/reference/)
* [Chrome DevTools: Network 패널 참조](https://developer.chrome.com/docs/devtools/network/)
* [Lighthouse 성능 점수 이해하기](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring)
* [Web Vitals의 Lab Data와 Field Data](https://web.dev/articles/lab-and-field-data-differences)
* [Vue 성능 가이드](https://vuejs.org/guide/best-practices/performance)
* [Nuxt 4 Routing과 code splitting](https://nuxt.com/docs/4.x/getting-started/routing)
