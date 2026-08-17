# 📌 Chapter 9: Vue/Nuxt Web Vitals 최적화 실전 (SSR, Hydration & Rendering)

Vue와 Nuxt의 최적화는 “번들 크기를 줄인다”는 한 가지 작업으로 끝나지 않습니다. 반응형 상태 변경은 Main Thread의 JavaScript·Virtual DOM Patch·Layout·Paint로 이어지고, Nuxt의 서버 렌더링과 Hydration 방식은 LCP 콘텐츠의 발견 시점과 첫 상호작용 비용을 바꿉니다. 이 챕터에서는 **원인 → 브라우저 동작 → Web Vital 변화**의 흐름으로 판단하는 방법을 다룹니다.

---

## 1. Vue 반응형 렌더링과 INP 최적화

### 1) Reactive State, `computed`, `watch`의 비용을 분리하기

Vue의 `ref`와 `reactive`는 의존성을 추적해 상태 변경 시 필요한 컴포넌트만 다시 렌더링합니다. 일반적인 규모에서는 충분히 빠르지만, 큰 중첩 객체·광범위한 `watchEffect`·비싼 계산·대량 DOM이 한 상호작용에 묶이면 INP가 나빠질 수 있습니다.

| Vue 기능 | 브라우저에서 생기는 비용 | 관리 원칙 |
| :--- | :--- | :--- |
| 큰 `reactive` / `ref` 객체 | 깊은 Proxy 관찰과 넓은 의존성 갱신 | 불변 대용량 데이터는 `shallowRef` / `shallowReactive` 검토 |
| `computed` | 의존성이 변할 때 계산 후 하위 effect 갱신 | 순수·작은 계산에 사용, 무거운 O(n) 작업은 별도 전략 |
| `watch` | 명시한 source 변경 시 side effect 실행 | debounce·취소·비동기 작업의 경계를 명확히 |
| `watchEffect` | 접근한 동기 의존성을 자동 추적 | 편리하지만 의도보다 넓은 상태를 읽지 않도록 제한 |
| Component Update | Virtual DOM 비교, DOM Patch, Layout/Paint | Props 안정화, DOM 수 축소, 큰 목록 가상화 |

`computed`는 같은 의존성 값에서는 결과를 캐시하지만, 검색어처럼 의존성이 매 입력마다 바뀌면 필터·정렬 자체를 마법처럼 빠르게 만들지는 않습니다. 또한 `shallowRef`는 최상위 `.value` 교체만 추적하므로, 내부 배열을 직접 변경하는 대신 새 배열을 대입하는 불변 갱신 규칙이 필요합니다.

```vue
<!-- ❌ 입력마다 Main Thread에서 대량 계산과 대량 DOM Patch 수행 -->
<script setup lang="ts">
import { ref, watch } from 'vue';

type Product = { id: number; name: string; score: number };

const query = ref('');
const products = ref<Product[]>([]);
const visibleProducts = ref<Product[]>([]);

watch(query, (keyword) => {
  const normalized = keyword.toLowerCase();

  visibleProducts.value = products.value
    .filter((product) => product.name.toLowerCase().includes(normalized))
    .sort((a, b) => b.score - a.score);
});
</script>

<template>
  <input v-model="query" type="search" placeholder="상품 검색">

  <article v-for="product in visibleProducts" :key="product.id">
    {{ product.name }}
  </article>
</template>
```

**문제점**

입력 Handler 뒤의 watcher가 매 키 입력마다 필터·정렬을 동기 실행하고, 새 배열 대입은 긴 목록의 Virtual DOM 비교와 DOM Patch를 유발합니다. 전자는 INP의 Processing Duration, 후자는 Presentation Delay를 키웁니다.

```vue
<!-- ⭕ 입력 빈도·반응형 범위·렌더링 범위를 함께 제한 -->
<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, watch } from 'vue';

type Product = { id: number; name: string; score: number };

const query = ref('');
const deferredQuery = ref('');
const products = shallowRef<readonly Product[]>([]);
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

watch(query, (value) => {
  clearTimeout(debounceTimer);

  debounceTimer = setTimeout(() => {
    deferredQuery.value = value.trim().toLowerCase();
  }, 150);
});

onBeforeUnmount(() => clearTimeout(debounceTimer));

const visibleProducts = computed(() => {
  const keyword = deferredQuery.value;

  return products.value
    .filter((product) => product.name.toLowerCase().includes(keyword))
    .sort((a, b) => b.score - a.score);
});
</script>

<template>
  <input v-model="query" type="search" placeholder="상품 검색">

  <ProductVirtualList :items="visibleProducts" />
</template>
```

**개선 효과**

짧은 연속 입력을 하나로 묶어 계산 횟수를 줄이고, 대용량 불변 데이터의 깊은 관찰을 피하며, 가상화 목록으로 실제 DOM node 수를 제한했습니다. 초기 JavaScript와 렌더링 비용이 낮아져 **INP 개선 가능성**이 생깁니다. 여전히 긴 Task가 남는다면 검색 인덱스·서버 검색·Web Worker로 계산 자체를 Main Thread 밖으로 옮겨야 합니다.

### 2) Component Re-render와 조건부 렌더링 선택

`v-if`와 `v-show`는 어느 한쪽이 항상 빠르지 않습니다. 화면에 없는 무거운 컴포넌트를 최초부터 만들지 않는지, 또는 자주 토글할 때 다시 Mount하지 않는지가 핵심입니다.

| 패턴 | 브라우저 동작 | 주 영향 지표 | 적합한 경우 |
| :--- | :--- | :--- | :--- |
| **`v-if`** | false일 때 DOM·listener·자식 컴포넌트를 생성하지 않음 | 초기 LCP/INP, 토글 시 INP | 드물게 열리는 큰 모달·패널 |
| **`v-show`** | 최초 Mount 후 CSS `display`만 전환 | 토글 INP, 초기 비용 | 자주 열고 닫는 가벼운 UI |
| **Dynamic Component** | `:is` 변경 시 대상 컴포넌트 Mount / Unmount | 전환 INP | 필요 시 `KeepAlive`를 측정 후 적용 |

화면과 무관한 상태가 바뀔 때 큰 하위 트리가 매번 갱신된다면 Props를 더 안정적으로 설계하고, 정말 큰 리스트에는 `v-memo`, `v-once`, 가상화를 검토합니다. 단 `v-memo`는 의존성 배열을 빠뜨리면 UI가 갱신되지 않을 수 있는 미세 최적화이므로 Performance Trace에서 병목이 확인된 경우에만 사용합니다.

```vue
<!-- 무거운 탭의 코드를 실제 필요 시점까지 분리 -->
<script setup lang="ts">
import { defineAsyncComponent, ref } from 'vue';

const activeTab = ref<'overview' | 'analytics'>('overview');
const AnalyticsPanel = defineAsyncComponent(
  () => import('./AnalyticsPanel.vue'),
);
</script>

<template>
  <button @click="activeTab = 'overview'">개요</button>
  <button @click="activeTab = 'analytics'">분석</button>

  <OverviewPanel v-if="activeTab === 'overview'" />
  <AnalyticsPanel v-else />
</template>
```

`defineAsyncComponent()`의 dynamic import는 번들 분할 지점이 됩니다. 초기 Bundle 다운로드·Parse·Execute·Hydration이 줄면 Main Thread가 빨리 비어 **LCP와 초기 INP가 개선될 수 있습니다.** 반대로 사용자가 버튼을 클릭한 뒤 처음 chunk를 받으면 그 상호작용이 늦어질 수 있으므로, 자주 열리는 패널은 hover나 viewport 진입 시 import를 선행하는 전략도 함께 검토합니다.

### 3) 무거운 Event Handler와 Main Thread 양보

클릭 Handler 안에서 즉시 필요한 UI 상태와 나중에 처리해도 되는 작업을 분리합니다. “처리 중” 상태를 먼저 Paint할 기회를 주고, 대량 작업은 Web Worker 또는 작은 Task로 나눕니다.

```typescript
type YieldingScheduler = {
  yield?: () => Promise<void>
};

function yieldToBrowser(): Promise<void> {
  const scheduler = (
    globalThis as typeof globalThis & { scheduler?: YieldingScheduler }
  ).scheduler;

  return scheduler?.yield?.()
    ?? new Promise<void>((resolve) => setTimeout(resolve, 0));
}

async function buildInChunks(items: readonly string[]) {
  for (let start = 0; start < items.length; start += 300) {
    buildSearchIndex(items.slice(start, start + 300));
    await yieldToBrowser();
  }
}
```

`await scheduler.yield()`는 브라우저가 입력과 Paint를 먼저 처리할 수 있도록 후속 Task로 양보합니다. 지원 범위가 아직 완전하지 않으므로 feature detection과 fallback을 유지해야 합니다. `requestAnimationFrame()`은 작은 시각 변경을 다음 프레임에 묶는 데는 적합하지만, 무거운 작업을 rAF Callback 안에 넣으면 Paint 직전에 Main Thread를 막으므로 대체재가 아닙니다.

---

## 2. Nuxt 렌더링 전략과 Web Vitals

### 1) SSR, SSG, CSR, Hydration의 선택 기준

Nuxt의 Universal Rendering은 서버에서 HTML을 만들고, 브라우저가 그 HTML을 빠르게 표시한 뒤 Vue가 Hydration하여 상호작용을 연결합니다. 이는 초기 콘텐츠와 이미지 URL을 빨리 보낼 수 있는 장점이 있지만, 서버 데이터 대기와 Hydration JavaScript 비용도 함께 관리해야 합니다.

| 전략 | 브라우저에서 달라지는 점 | 주 영향 지표 | 주의점 |
| :--- | :--- | :--- | :--- |
| **SSR** | 제목·LCP 이미지 URL을 초기 HTML에서 발견 | LCP | 느린 서버 API가 TTFB를 악화 |
| **SSG / Prerender** | CDN의 정적 HTML을 빠르게 수신 | LCP | 변경·개인화 요구에 제약 |
| **CSR** | JS 다운로드·실행 뒤 콘텐츠 DOM 생성 | LCP, 초기 INP | LCP 후보 발견과 Paint가 뒤로 밀림 |
| **Hydration** | 서버 HTML에 Event와 반응형 상태를 연결 | INP, CLS | 큰 Bundle·Mismatch가 Main Thread와 재렌더링 비용 증가 |

Hydration mismatch는 Vue가 서버 DOM을 버리고 컴포넌트 트리를 다시 렌더링하게 할 수 있습니다. 이는 초기 상호작용을 늦추고 화면 깜빡임·CLS를 만들 수 있으므로, 시간·난수·브라우저 전용 API를 SSR 결과에 그대로 섞지 않습니다. 페이지 데이터에는 `$fetch()`를 직접 호출하는 것보다 `useFetch()` 또는 `useAsyncData()`를 사용해 서버 결과와 Hydration payload를 공유하는 편이 안전합니다.

```vue
<!-- ❌ LCP 후보를 ClientOnly와 Hydration 이후까지 미룸 -->
<script setup lang="ts">
import { onMounted, ref } from 'vue';

type Hero = { title: string; imageUrl: string };
const hero = ref<Hero | null>(null);

onMounted(async () => {
  hero.value = await $fetch<Hero>('/api/home/hero');
});
</script>

<template>
  <ClientOnly>
    <section v-if="hero" class="hero">
      <img :src="hero.imageUrl" :alt="hero.title" loading="lazy">
      <h1>{{ hero.title }}</h1>
    </section>
  </ClientOnly>
</template>
```

**문제점**

`<ClientOnly>`의 기본 slot은 서버 HTML에 포함되지 않고, `onMounted()`의 요청은 Hydration 뒤에 시작됩니다. 따라서 LCP 이미지 URL의 발견이 늦어지며, 뷰포트 안 LCP 후보의 `loading="lazy"`는 요청을 더 미룹니다. 이미지 크기를 생략한 점은 CLS 위험도 만듭니다.

```vue
<!-- ⭕ SSR HTML에서 LCP 콘텐츠와 이미지 요청을 즉시 시작 -->
<script setup lang="ts">
type Hero = { title: string; imageUrl: string };

const { data: hero } = await useFetch<Hero>('/api/home/hero', {
  key: 'home-hero',
});
</script>

<template>
  <section v-if="hero" class="hero">
    <NuxtImg
      :src="hero.imageUrl"
      :alt="hero.title"
      width="1440"
      height="810"
      sizes="100vw"
      format="webp"
      loading="eager"
      :preload="{ fetchPriority: 'high' }"
    />
    <h1>{{ hero.title }}</h1>
  </section>
</template>
```

**개선 효과**

서버가 Hero 데이터를 가져와 HTML과 payload를 전달하므로 브라우저는 Hydration 완료를 기다리지 않고 제목과 LCP 이미지 URL을 발견합니다. `NuxtImg`의 `preload`와 `fetchPriority: 'high'`는 LCP 이미지의 요청 대기를 줄이고, `width`·`height`는 이미지 공간을 미리 확보해 CLS까지 방어합니다.

> [!WARNING]
> SSR은 LCP의 만능 해결책이 아닙니다. 서버 API가 느리면 TTFB가 길어질 수 있습니다. 변경 빈도가 낮은 랜딩·문서 페이지는 SSG/prerender와 CDN 캐시가 유리할 수 있으며, `server: false`나 `useLazyFetch()`는 LCP 콘텐츠가 아닌 보조 데이터에 한정해야 합니다.

### 2) Lazy Component, Lazy Hydration, Route-level Code Splitting

Nuxt의 `pages/` 파일은 기본적으로 route-level code splitting을 사용합니다. 즉 사용자가 방문한 경로의 JavaScript를 우선 전송합니다. 더 세밀하게는 컴포넌트 이름 앞에 `Lazy`를 붙여 dynamic import를 만들 수 있습니다.

```vue
<!-- ❌ 첫 화면과 무관한 패널을 항상 import하고 hydrate -->
<script setup lang="ts">
import AnalyticsPanel from '~/components/AnalyticsPanel.vue';
</script>

<template>
  <AnalyticsPanel />
</template>
```

```vue
<!-- ⭕ 필요할 때만 chunk를 로드하고, 비핵심 상호작용을 늦춤 -->
<script setup lang="ts">
const showAnalytics = ref(false);
</script>

<template>
  <button @click="showAnalytics = true">분석 패널 열기</button>

  <LazyAnalyticsPanel v-if="showAnalytics" />
  <LazyProductReviews hydrate-on-visible />
</template>
```

**개선 효과**

`<LazyAnalyticsPanel>`은 분리된 chunk를 만들고, `v-if`가 false인 동안에는 loader를 실행하지 않습니다. 초기 JavaScript 다운로드·Parse·Execute·Hydration이 줄어 Main Thread가 빨리 비므로 LCP와 초기 INP 개선으로 이어질 수 있습니다. `<LazyProductReviews hydrate-on-visible>`은 서버 HTML은 유지하면서 화면에 보일 때까지 비핵심 상호작용 연결을 미뤄 초기 Hydration 경합을 줄입니다.

> [!CAUTION]
> `Lazy` prefix만으로 runtime 비용이 자동으로 줄지는 않습니다. 처음부터 렌더되는 Lazy 컴포넌트는 일찍 로드될 수 있으므로 조건부 렌더링 또는 지연 Hydration을 함께 판단해야 합니다. 현재 Nuxt의 내장 lazy hydration은 SFC와 템플릿의 명시적 props를 전제로 하며, prop 변경은 즉시 Hydration을 유발할 수 있습니다. 결제·검색 입력처럼 첫 클릭이 중요한 UI에는 `hydrate-on-interaction`으로 비용을 떠넘기지 않습니다.

### 3) `<ClientOnly>`, 이미지·폰트·제3자 Script의 안정화

`<ClientOnly>`은 브라우저 API가 필요한 지도·에디터·차트에 유용하지만, 내부 기본 slot은 서버 빌드에서 제거됩니다. 하위 CSS도 초기 HTML에 인라인되지 않을 수 있으므로 LCP 제목·히어로 이미지·핵심 본문을 감싸는 용도로 사용하면 안 됩니다.

```vue
<!-- ❌ ClientOnly mount가 본문을 아래로 밀 수 있음 -->
<template>
  <ClientOnly>
    <StoreMap />
  </ClientOnly>

  <article>상품 상세 설명</article>
</template>
```

```vue
<!-- ⭕ 서버 단계부터 최종 높이와 같은 공간을 예약 -->
<template>
  <section class="map-shell" aria-label="매장 위치">
    <ClientOnly>
      <StoreMap class="store-map" />

      <template #fallback>
        <div class="map-skeleton" aria-hidden="true" />
      </template>
    </ClientOnly>
  </section>

  <article>상품 상세 설명</article>
</template>

<style scoped>
.map-shell {
  block-size: 320px;
}

.store-map,
.map-skeleton {
  block-size: 100%;
}

.map-skeleton {
  border-radius: 12px;
  background: #e5e7eb;
}
</style>
```

**개선 효과**

예시처럼 fallback과 최종 지도 영역의 높이를 정확히 같게 유지하므로 ClientOnly 컴포넌트가 Mount되어도 아래 본문이 이동하지 않습니다. 지도마다 높이가 달라질 수 있다면 고정 `block-size` 대신 실제 최종 비율의 `aspect-ratio`를 부모 slot에 적용합니다. 예약 CSS를 `<ClientOnly>` 내부 컴포넌트가 아닌 부모에 두어 SSR 단계에도 적용한 점이 중요합니다.

* **Nuxt Image**: LCP 이미지에는 `width`, `height`, `sizes`, 적절한 포맷과 한정된 preload를 사용하고, 뷰포트 밖 이미지에만 `loading="lazy"`를 적용합니다.
* **Nuxt Fonts / 웹 폰트**: WOFF2·subset·self-hosting과 fallback font metric을 사용해 FOIT/FOUT와 줄바꿈 변화를 줄입니다. `@nuxt/fonts`는 로컬 캐시와 metric fallback을 제공하지만 별도 모듈이므로 실제 한글 fallback까지 측정해야 합니다.
* **Third-party Script**: `async`나 `defer`가 HTML 파서를 막지 않더라도 다운로드·실행은 Main Thread와 네트워크를 사용합니다. 동의 이후, 사용자 의도 이후, 또는 idle 시점으로 늦추고, 성능 Trace에서 실제 비용을 확인합니다.

### 📊 Vue/Nuxt 최적화와 LCP / INP / CLS 영향

| 최적화 | 원인 → 브라우저 동작 → 지표 변화 | 주요 지표 |
| :--- | :--- | :--- |
| SSR `useFetch`로 히어로 렌더링 | 초기 HTML에 콘텐츠·URL 포함 → Resource Load Delay 감소 → LCP 개선 가능 | LCP |
| `NuxtImg`의 preload / high priority | LCP 이미지 요청이 비핵심 리소스 뒤로 밀릴 가능성 감소 → 다운로드 시작 앞당김 | LCP |
| Lazy Component + 조건부 렌더링 | 초기 Bundle 감소 → JS Parse·Execute·Hydration 감소 → Main Thread 여유 증가 | INP, LCP |
| Lazy Hydration | 초기 상호작용이 불필요한 컴포넌트의 Hydration을 지연 → 초기 Main Thread 경합 감소 | INP |
| `shallowRef`, 안정 Props, 가상화 | Reactive effect·Virtual DOM Patch·DOM 수 감소 → 다음 Paint가 빨라짐 | INP |
| Worker / Task 분할 | 긴 JavaScript Task 제거·양보 → Input Delay 감소 | INP |
| ClientOnly fallback 공간 | 늦게 Mount되는 UI가 주변을 밀지 않음 | CLS |
| Nuxt Fonts와 font metric | 웹 폰트 교체 시 글자 폭·줄바꿈 변화 감소 | CLS |
| 제3자 Script 지연 | 초기 네트워크·JS 실행 경쟁 완화 | LCP, INP |

---

## 3. Field Data를 수집하는 Nuxt RUM 패턴

Field Data가 없으면 배포 뒤 실제 사용자에게 어떤 LCP 요소, Interaction, Layout Shift가 발생했는지 알기 어렵습니다. Nuxt에서는 client plugin에 `web-vitals`를 한 번만 등록해 자체 분석 endpoint로 보내는 방식이 실용적입니다.

```typescript
// plugins/web-vitals.client.ts
import { onCLS, onINP, onLCP } from 'web-vitals/attribution';

const initialPath = window.location.pathname;

function reportVital(metric: {
  name: string;
  value: number;
  id: string;
  attribution?: unknown;
}) {
  const payload = JSON.stringify({
    name: metric.name,
    value: metric.value,
    id: metric.id,
    path: initialPath,
    attribution: metric.attribution,
  });

  navigator.sendBeacon('/api/rum/web-vitals', payload);
}

export default defineNuxtPlugin(() => {
  onLCP(reportVital);
  onINP(reportVital);
  onCLS(reportVital);
});
```

`web-vitals/attribution` build는 LCP 대상 요소, 느린 INP 상호작용 대상, 가장 큰 CLS 대상 같은 진단 정보를 추가로 제공합니다. 위 plugin은 **초기 페이지 방문**의 경로를 미리 캡처해, metric이 tab 숨김 시점에 보고되어도 SPA 전환 뒤의 URL로 잘못 귀속되지 않게 합니다. Nuxt의 soft navigation별 성능까지 수집하려면 navigation URL 또는 route hook을 함께 설계합니다. 수집 서버에서는 selector·URL·사용자 식별 정보에 개인정보가 섞이지 않도록 정리하고, 사용자·기기·경로·배포 버전별 P75를 대시보드로 집계합니다.

> [!IMPORTANT]
> Web Vitals API의 지원 범위는 브라우저와 지표마다 다릅니다. 특정 브라우저에서 callback이 보고되지 않았다는 사실은 점수가 좋다는 뜻이 아니므로, RUM 대시보드에는 브라우저별 측정 가능 방문 수와 미보고 비율을 함께 표시해야 합니다.

---

## 4. Web Vitals 핵심 지표 요약 및 성능 분석 체크리스트

### 📊 Web Vitals 핵심 지표 요약

| Metric | 의미 | Good 기준 | 대표적인 문제 | 주요 개선 방법 |
| ------ | ------- | ------- | ----------------- | ----------------- |
| LCP | 로딩 경험 | ≤ 2.5s | 느린 서버, 큰 이미지 | 이미지/서버/렌더링 최적화 |
| INP | 반응성 | ≤ 200ms | Long Task, 무거운 JS | Main Thread 작업 감소 |
| CLS | 시각적 안정성 | ≤ 0.1 | Layout Shift | 공간 사전 확보 |

### 📋 Web Vitals 성능 분석 체크리스트

* [ ] PageSpeed Insights, Search Console, 자체 RUM에서 모바일·데스크톱 P75를 분리해 확인했는가?
* [ ] Lighthouse 점수와 Field Core Web Vitals를 같은 값으로 취급하지 않았는가?
* [ ] LCP Candidate가 무엇인지 확인하고, 초기 HTML에서 이미지/텍스트를 발견할 수 있게 했는가?
* [ ] LCP 이미지에 `loading="lazy"`를 제거하고, 필요한 경우에만 preload·`fetchpriority="high"`를 적용했는가?
* [ ] TTFB, Resource Load Delay, Resource Load Duration, Element Render Delay 중 실제 긴 구간을 Network/Trace에서 확인했는가?
* [ ] 느린 클릭·탭·키 입력을 DevTools Performance 패널에서 녹화하고 Long Task와 Component Update를 추적했는가?
* [ ] 큰 목록은 가상화하고, 대용량 계산은 debounce·Worker·Task 분할로 Main Thread에서 분리했는가?
* [ ] `requestAnimationFrame()` 내부에 무거운 작업을 넣지 않았고, `scheduler.yield()`에는 fallback을 두었는가?
* [ ] 이미지·비디오·iframe·광고·ClientOnly fallback에 최종 크기 또는 `aspect-ratio`를 예약했는가?
* [ ] 웹 폰트 교체와 Hydration mismatch가 CLS/INP를 만들지 않는지 실제 저사양 기기에서 검증했는가?
* [ ] Lazy Component와 Lazy Hydration이 첫 클릭에 비용을 떠넘기지 않는지 사용자 흐름으로 확인했는가?
* [ ] 변경 뒤 Lighthouse/DevTools로 재측정하고, 배포 뒤 RUM/CrUX 추세로 효과와 회귀를 모니터링하는가?

### 📚 공식 참고 자료

* [Vue 성능 가이드](https://vuejs.org/guide/best-practices/performance)
* [Vue Async Component](https://vuejs.org/guide/components/async.html)
* [Nuxt Rendering 개념](https://nuxt.com/docs/4.x/guide/concepts/rendering)
* [Nuxt Hydration Best Practices](https://nuxt.com/docs/4.x/guide/best-practices/hydration)
* [Nuxt Components와 Lazy Hydration](https://nuxt.com/docs/4.x/directory-structure/app/components)
* [Nuxt Image `NuxtImg`](https://image.nuxt.com/usage/nuxt-img)
* [Nuxt Fonts의 fallback metric](https://fonts.nuxt.com/advanced)
* [`web-vitals` RUM 라이브러리](https://github.com/GoogleChrome/web-vitals)
