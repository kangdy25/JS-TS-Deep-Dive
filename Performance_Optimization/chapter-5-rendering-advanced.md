# 📌 Chapter 5: 브라우저 렌더링·실행 최적화 (Rendering & Execution Advanced)

화면이 끊기는 원인은 "GPU를 쓰지 않아서" 하나로 설명되지 않습니다. JavaScript 실행, 스타일 계산, 레이아웃, 페인트, 합성 중 어느 단계가 오래 걸리는지 확인하고, 필요한 범위만 줄여야 합니다. 이 장에서는 프레임 예산을 지키는 렌더링 패턴과 Main Thread를 비우는 실행 제어 방법을 다룹니다.

> [!IMPORTANT]
> CLS와 INP의 점수 계산·진단 방법은 [Chapter 8](./chapter-8-core-web-vitals.md), Vue/Nuxt 상태 갱신과 Hydration이 사용자 반응성에 미치는 영향은 [Chapter 9](./chapter-9-vue-nuxt-web-vitals.md)에서 다룹니다. 여기서는 프레임워크와 무관한 브라우저 동작을 먼저 익힙니다.

---

## 1. 렌더링 비용을 단계별로 분리하기

모든 DOM 변경이 전체 렌더링 경로를 다시 실행하는 것은 아닙니다. 그러나 한 프레임 안에 Main Thread가 오래 점유되면 다음 Paint가 밀리며 jank가 발생합니다. 60Hz 화면의 16.7ms뿐 아니라 고주사율 화면의 더 짧은 프레임 예산도 고려해, "고정된 FPS 숫자"보다 **늦은 프레임과 긴 작업을 줄이는 것**을 목표로 잡습니다.

~~~mermaid
graph LR
  JS[JavaScript] --> Style[Style 계산]
  Style --> Layout[Layout]
  Layout --> Paint[Paint]
  Paint --> Composite[Composite]
  JS --> |작은 시각 상태 변경| Composite
~~~

| 변경 예 | 보통 발생하는 비용 | 설계 원칙 |
| :--- | :--- | :--- |
| <code>width</code>, <code>height</code>, <code>top</code>, 글자 크기 | Layout → Paint → Composite | 반복 애니메이션에서 피하고, 범위를 제한 |
| 배경색, 그림자, 복잡한 filter | Paint → Composite | 큰 영역·복잡한 효과의 빈번한 변경을 피함 |
| <code>transform</code>, <code>opacity</code> | compositor 단계로 처리될 수 있음 | 애니메이션에 우선 고려하되, 실제 Trace에서 확인 |

브라우저는 요소를 어떤 compositing layer로 만들지 자체적으로 결정합니다. <code>transform</code>이나 <code>opacity</code>가 Layout을 피하는 경우가 많아도, 큰 레이어의 rasterization·blend·메모리 비용이 생길 수 있으므로 "항상 GPU에서 빠르다"고 가정하지 않습니다.

### 1) 강제 Layout을 만드는 read/write 혼합 피하기

스타일을 바꾼 직후 <code>offsetHeight</code>, <code>getBoundingClientRect()</code>처럼 레이아웃 값을 읽으면 브라우저가 대기 중인 계산을 즉시 끝내야 할 수 있습니다. 여러 요소에 이를 반복하면 Layout Thrashing이 됩니다.

~~~typescript
// ❌ write와 layout read를 섞어 반복한다.
for (const card of cards) {
  card.style.width = '50%'
  const height = card.offsetHeight
  console.log(height)
}

// ⭕ 필요한 읽기를 먼저 모으고, 시각적 쓰기는 한 번에 반영한다.
const heights = cards.map((card) => card.offsetHeight)

requestAnimationFrame(() => {
  cards.forEach((card, index) => {
    card.style.setProperty('--measured-height', `${heights[index]}px`)
  })
})
~~~

이 패턴은 Layout 비용 자체를 없애지는 않지만, 읽기와 쓰기가 서로를 강제로 깨우는 횟수를 줄입니다. 실제 병목은 [Chapter 2](./chapter-2-devtools.md)의 Performance 패널에서 Rendering·Painting 구간과 Call Tree로 확인합니다.

---

## 2. 애니메이션과 compositing을 안전하게 사용하기

### 1) 먼저 속성과 애니메이션 범위를 선택하기

이동·페이드처럼 시각적 위치만 바뀌는 동작은 <code>top</code>·<code>left</code> 대신 <code>transform</code>과 <code>opacity</code>를 우선 검토합니다. 단, 문서 흐름 자체가 바뀌어야 하는 UI라면 transform으로 문제를 숨기지 말고 레이아웃을 명시적으로 설계해야 합니다.

~~~css
.panel {
  opacity: 0;
  transform: translateY(12px);
  transition: transform 180ms ease-out, opacity 180ms ease-out;
}

.panel.is-open {
  opacity: 1;
  transform: translateY(0);
}

@media (prefers-reduced-motion: reduce) {
  .panel {
    transition: none;
  }
}
~~~

### 2) <code>will-change</code>는 측정 뒤 잠시만 사용하기

<code>will-change</code>는 레이어 생성이나 GPU 가속을 보장하는 스위치가 아니라, 가까운 시점에 바뀔 속성을 브라우저에 알리는 힌트입니다. 브라우저가 이미 잘 처리하는 애니메이션에는 추가하지 않고, Trace에서 문제가 확인된 소수 요소에만 애니메이션 직전 적용한 뒤 해제합니다.

~~~css
.panel.is-preparing {
  will-change: transform, opacity;
}
~~~

~~~typescript
function preparePanelAnimation(panel: HTMLElement) {
  // pointerenter, route 전환 시작처럼 실제 변경보다 조금 앞선 시점에 호출한다.
  panel.classList.add('is-preparing')
}

function finishPanelAnimation(panel: HTMLElement) {
  // transition 또는 animation 종료 뒤 힌트를 회수한다.
  panel.classList.remove('is-preparing')
}
~~~

> [!CAUTION]
> <code>translateZ(0)</code> 같은 과거 레이어 강제 기법을 최적화 기본값으로 쓰지 않습니다. 많은 요소에 <code>will-change</code>를 상시 적용하면 메모리와 compositing 복잡도가 늘어 오히려 느려질 수 있고, stacking context도 달라질 수 있습니다.

---

## 3. 렌더링 범위와 레이아웃 안정화

### 1) Skeleton은 최종 공간과 같아야 한다

스켈레톤의 회색 배경 자체는 Layout Shift를 막지 못합니다. 최종 콘텐츠가 차지할 높이·비율과 skeleton shell이 다르면, 데이터가 도착한 순간 주변 콘텐츠가 이동합니다. 이미지·비디오·embed에는 intrinsic 크기 또는 <code>aspect-ratio</code>를, 데이터 카드에는 예측 가능한 <code>min-block-size</code>를 둡니다.

~~~css
.product-media {
  aspect-ratio: 16 / 9;
  background: #e5e7eb;
}

.product-media > img,
.product-media > video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.review-card-shell {
  min-block-size: 168px;
}
~~~

레이아웃 안정성의 원인·점수·폰트·광고 처리까지는 [Chapter 8](./chapter-8-core-web-vitals.md)을 기준으로 추적합니다.

### 2) 화면 밖의 큰 subtree에는 <code>content-visibility</code> 검토

<code>content-visibility: auto</code>는 화면 밖 콘텐츠의 렌더링 작업을 건너뛸 수 있게 하는 containment입니다. 복잡한 댓글 목록이나 긴 문서 섹션처럼 처음에는 보이지 않는 독립 block에 효과적입니다. 다만 브라우저가 건너뛴 콘텐츠의 크기를 추정할 수 있도록 <code>contain-intrinsic-size</code>를 함께 제공합니다.

~~~css
.comment-section {
  content-visibility: auto;
  contain-intrinsic-size: auto 720px;
}
~~~

<code>720px</code>는 실제 섹션 높이에 가까운 fallback 값이어야 합니다. 값이 지나치게 다르면 섹션이 화면에 들어올 때 scroll position이나 scrollbar가 튈 수 있습니다. 지원하지 않는 브라우저에서는 보통 렌더링으로 자연스럽게 fallback하므로, 기능 자체가 아니라 성능 최적화로 취급합니다.

---

## 4. 이벤트 빈도와 Main Thread 작업 제어

이벤트가 자주 발생한다고 모두 debounce나 throttle을 걸면 사용성까지 늦어집니다. 즉시 보여야 하는 UI 상태와 나중에 처리해도 되는 계산·네트워크 작업을 분리합니다.

| 상황 | 우선 선택 | 주의점 |
| :--- | :--- | :--- |
| 검색 input | 입력값과 포커스 UI는 즉시 갱신, 서버 요청·무거운 검색만 debounce | 이전 응답이 나중에 도착해 새 결과를 덮지 않게 취소 |
| 요소 노출 감지 | scroll polling보다 Intersection Observer | root margin은 실제 다운로드 시간으로 조정 |
| 스크롤 시 작은 시각 효과 | passive listener와 작은 rAF write | rAF 안에 무거운 필터·파싱을 넣지 않음 |
| resize 대응 | CSS media/container query, 필요한 경우 ResizeObserver | 모든 resize 이벤트에서 layout read/write 반복 금지 |
| 클릭 후 무거운 처리 | pending UI를 먼저 Paint하고 뒤 작업을 분리 | 클릭 결과가 늦게 보여 INP가 나빠지지 않게 함 |

### 1) debounce할 것은 요청이지 입력 자체가 아니다

~~~typescript
let searchTimer: ReturnType<typeof setTimeout> | undefined
let activeRequest: AbortController | undefined
let requestSequence = 0

function scheduleSearch(keyword: string) {
  clearTimeout(searchTimer)
  activeRequest?.abort()

  // 취소된 요청의 응답이 뒤늦게 도착해도 화면을 덮지 못하게 한다.
  const currentSequence = ++requestSequence

  searchTimer = setTimeout(async () => {
    activeRequest = new AbortController()

    try {
      const response = await fetch(
        '/api/products?q=' + encodeURIComponent(keyword),
        { signal: activeRequest.signal },
      )

      const products = await response.json()
      if (currentSequence !== requestSequence) return
      renderSearchResults(products)
    } catch (error) {
      if ((error as DOMException).name !== 'AbortError') {
        reportSearchError(error)
      }
    }
  }, 180)
}
~~~

타이머 지연값은 제품의 반응 기대치와 서버 비용을 기준으로 정합니다. 300ms나 100ms를 보편적인 정답으로 두지 않고, component unmount 시 타이머와 요청을 정리합니다.

### 2) rAF는 Paint 직전의 작은 시각 변경에만 사용하기

~~~typescript
let frameId: number | null = null

window.addEventListener(
  'scroll',
  () => {
    if (frameId !== null) return

    frameId = requestAnimationFrame(() => {
      frameId = null
      updateScrollIndicator()
    })
  },
  { passive: true },
)
~~~

<code>requestAnimationFrame()</code>은 여러 이벤트에서 나온 작은 시각 변경을 한 프레임에 모으는 데 적합합니다. 브라우저가 scroll event를 덜 발생시키게 해 주는 기능은 아니며, callback 안의 긴 계산은 Paint 직전에 Main Thread를 막습니다.

### 3) 긴 반복 작업은 task 사이에서 양보하기

클릭 직후에는 pending UI를 먼저 반영하고, 길게 이어지는 계산은 중간중간 브라우저에 제어를 돌려줄 수 있습니다. <code>scheduler.yield()</code>는 continuation을 새 task로 예약하는 API이지만 모든 브라우저에서 사용할 수 있다고 가정하면 안 됩니다. 기능을 확인하고 <code>setTimeout</code> fallback을 둡니다.

~~~typescript
type SchedulerWithYield = {
  yield?: () => Promise<void>
}

function yieldToBrowser() {
  const scheduler = (globalThis as typeof globalThis & {
    scheduler?: SchedulerWithYield
  }).scheduler

  return scheduler?.yield?.() ?? new Promise<void>((resolve) => setTimeout(resolve, 0))
}

type SearchRecord = { id: string; searchText: string }

async function buildSearchIndex(records: readonly SearchRecord[]) {
  const index = new Map<string, SearchRecord>()

  for (const [indexOfRecord, record] of records.entries()) {
    index.set(record.id, record)

    // 실제 작업량을 Trace로 확인해 yield 간격을 정한다.
    if (indexOfRecord > 0 && indexOfRecord % 200 === 0) await yieldToBrowser()
  }

  return index
}
~~~

양보는 총 CPU 시간을 없애지 않으며, 너무 자주 나누면 task scheduling 비용이 커질 수 있습니다. 반복 계산이 장시간 계속되거나 결과 렌더링도 크다면 Worker 오프로딩과 비교합니다.

---

## 5. Web Worker로 CPU 계산을 분리하기

정렬, 검색 인덱스 생성, 대량 변환처럼 DOM과 무관한 CPU 작업은 Worker로 보낼 수 있습니다. Worker는 별도 global context에서 실행되므로 DOM·Vue component instance·window에 직접 접근할 수 없습니다. 결과를 받은 뒤에도 Main Thread의 DOM Patch 범위를 작게 유지해야 합니다.

~~~typescript
// composables/useProductSearch.ts
import { onBeforeUnmount, onMounted, shallowRef } from 'vue'

type SearchResult = { id: string; name: string }

export function useProductSearch() {
  const results = shallowRef<readonly SearchResult[]>([])
  let searchWorker: Worker | undefined

  // onMounted는 browser에서만 실행되므로 Nuxt SSR에서도 안전하다.
  onMounted(() => {
    searchWorker = new Worker(
      new URL('../workers/product-search.worker.ts', import.meta.url),
      { type: 'module' },
    )

    searchWorker.addEventListener('message', (event: MessageEvent<SearchResult[]>) => {
      results.value = event.data
    })

    searchWorker.addEventListener('error', (event) => {
      reportWorkerError(event.message)
    })
  })

  function search(query: string) {
    searchWorker?.postMessage({ type: 'search', query })
  }

  onBeforeUnmount(() => {
    searchWorker?.terminate()
  })

  return { results, search }
}
~~~

~~~typescript
// workers/product-search.worker.ts
type SearchRequest = {
  type: 'search'
  query: string
}

self.onmessage = (event: MessageEvent<SearchRequest>) => {
  if (event.data.type !== 'search') return

  const result = searchIndex(event.data.query)
  self.postMessage(result)
}
~~~

<code>postMessage()</code>는 기본적으로 structured clone으로 데이터를 복사합니다. 큰 binary buffer를 한 번만 넘기고 원본을 더 쓰지 않는 경우에는 transferable object로 복사 비용을 줄일 수 있지만, transfer 뒤 원래 <code>ArrayBuffer</code>는 사용할 수 없습니다. 작은 작업은 Worker 생성·메시지 복사 비용이 더 클 수 있으므로 Performance Trace로 전후를 비교합니다.

### 📋 렌더링·실행 체크리스트

* [ ] Performance Trace에서 긴 시간이 JavaScript, Layout, Paint 중 어디에 있는지 먼저 확인했는가?
* [ ] 반복 애니메이션이 문서 흐름 변경이 아니라 <code>transform</code> / <code>opacity</code>로 표현될 수 있는가?
* [ ] <code>will-change</code>를 상시 선언하지 않고, 측정된 소수 요소에 한시적으로 적용하는가?
* [ ] skeleton·이미지·iframe·동적 카드의 최종 공간을 사전에 확보했는가?
* [ ] <code>content-visibility</code> 대상이 offscreen의 독립 subtree이며, 적절한 intrinsic size를 가졌는가?
* [ ] debounce·rAF·Worker가 즉시 필요한 UI feedback을 늦추지 않는가?
* [ ] Worker의 복사·오류·종료 lifecycle까지 설계했는가?

### 📚 공식 참고 자료

* [MDN: will-change](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/will-change)
* [MDN: content-visibility](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/content-visibility)
* [MDN: contain-intrinsic-size](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/contain-intrinsic-size)
* [MDN: `scheduler.yield()`](https://developer.mozilla.org/en-US/docs/Web/API/Scheduler/yield)
* [MDN: Using Web Workers](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)
* [Web.dev: Optimize INP](https://web.dev/articles/optimize-inp)
* [Web.dev: Optimize CLS](https://web.dev/articles/optimize-cls)
