# 📌 Chapter 4: 로딩 패턴 및 리소스 우선순위 (Lazy Loading, Preload & Code Splitting)

성능 최적화에서 중요한 것은 "무조건 늦게 받기"가 아니라, **현재 화면에 꼭 필요한 리소스는 빨리 발견시키고** 나중에 필요할 리소스만 안전하게 미루는 것입니다. 이 장에서는 이미지·컴포넌트·라우트를 대상으로 브라우저의 요청 우선순위, 지연 로딩, 코드 분할, 사용자 의도 기반 사전 로딩을 설계하는 방법을 다룹니다.

> [!IMPORTANT]
> LCP 후보와 Core Web Vitals의 측정·진단은 [Chapter 8](./chapter-8-core-web-vitals.md), Nuxt의 SSR·Hydration·Lazy Component 전략은 [Chapter 9](./chapter-9-vue-nuxt-web-vitals.md)에서 심화합니다. 이 장은 프레임워크에 앞서는 **리소스 전달 원칙**에 집중합니다.

---

## 1. 먼저 결정하기: 무엇을 지금, 나중에, 미리 받을까?

브라우저는 HTML을 파싱하는 동안 이미지·스타일·스크립트를 발견하고, preload scanner로 일부 리소스를 앞서 찾습니다. 따라서 초기 HTML에 이미 들어 있는 일반적인 이미지까지 모두 preload할 필요는 없습니다. 먼저 해당 리소스가 어느 사용자 흐름에 속하는지 분류합니다.

| 리소스 위치 / 목적 | 기본 전략 | 피해야 할 것 |
| :--- | :--- | :--- |
| 초기 뷰포트의 LCP 후보 이미지 | 초기 HTML에 <code>src</code> / <code>srcset</code> / <code>sizes</code> 제공, 크기 예약, 필요할 때만 한 개에 높은 우선순위 힌트 | <code>loading="lazy"</code>, JavaScript로 늦게 <code>src</code> 삽입 |
| 초기 화면 밖의 이미지·iframe | native <code>loading="lazy"</code>와 명시적 크기 | 모든 이미지를 eager 또는 preload |
| CSS background, JS 삽입 등 늦게 발견되는 현재 페이지 핵심 리소스 | 정확한 preload | 이미 발견 가능한 일반 리소스까지 선행 요청 |
| 빠르게 필요한 cross-origin origin | 검증된 소수 origin에 <code>preconnect</code> | 모든 서드파티 origin에 연결 선점 |
| 다음 화면에서 쓸 가능성이 높은 코드 | 사용자 의도 후 <code>import()</code> warm-up 또는 낮은 우선순위 prefetch | 모든 경로와 chunk를 첫 화면에서 예측 다운로드 |

리소스 우선순위는 추측이 아니라 Network Waterfall과 실제 사용자 흐름으로 검증합니다. 현재 화면의 모든 것을 우선순위 높게 만들면, 제한된 대역폭 안에서 정작 중요한 요청이 서로 경쟁하게 됩니다.

---

## 2. 이미지와 iframe 지연(Lazy) 로딩

### 1) native <code>loading="lazy"</code>를 기본으로 사용하기

초기 화면 밖의 이미지와 iframe에는 브라우저 기본 lazy loading이 가장 간단하고 유지보수하기 좋습니다. 브라우저가 뷰포트와의 계산된 거리를 기준으로 요청 시점을 정하므로, 직접 제어가 꼭 필요한 경우에만 JavaScript를 추가합니다.

~~~html
<!-- 최종 비율을 브라우저가 미리 계산할 수 있게 width/height도 함께 제공 -->
<img
  src="/images/review-card-800.webp"
  srcset="/images/review-card-480.webp 480w, /images/review-card-800.webp 800w"
  sizes="(min-width: 768px) 320px, 100vw"
  width="800"
  height="600"
  loading="lazy"
  decoding="async"
  alt="사용자 후기 이미지"
>

<iframe
  src="https://example.com/embed"
  title="매장 위치"
  width="640"
  height="360"
  loading="lazy"
></iframe>
~~~

<code>width</code>와 <code>height</code>는 화면에 보이는 표시 크기를 고정하는 속성이 아니라, 이미지가 내려오기 전 **종횡비를 계산할 근거**입니다. 반응형 CSS에서 <code>width: 100%; height: auto;</code>를 함께 써도 레이아웃 공간은 미리 예약됩니다. <code>decoding="async"</code>도 힌트이므로, 핵심 이미지의 표시 시점을 보장하는 수단으로 사용하지는 않습니다.

> [!WARNING]
> 초기 뷰포트의 히어로·상품 대표 이미지처럼 LCP 후보가 될 수 있는 요소에는 lazy loading을 적용하지 않습니다. 이 경우 브라우저와 preload scanner가 초기 HTML에서 URL을 바로 발견하도록 해야 합니다.

### 2) Intersection Observer가 필요한 경우

native lazy loading은 대부분 충분하지만, 네트워크 상황에 맞춰 더 이른 시점에 시작하거나, 이미지 외의 복잡한 컴포넌트를 관찰하거나, 노출 시 효과를 제어해야 한다면 Intersection Observer를 사용합니다. 다음 Vue 3 directive는 unmount 시 관찰을 해제하므로 화면 전환 뒤에도 observer가 남지 않습니다.

~~~typescript
// directives/lazy.ts
import type { Directive } from 'vue'

type LazyImageElement = HTMLImageElement & {
  lazyObserver?: IntersectionObserver
}

export const vLazy: Directive<HTMLImageElement, string> = {
  mounted(el, binding) {
    const lazyImage = el as LazyImageElement

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return

        el.src = binding.value
        observer.unobserve(el)
        observer.disconnect()
        delete lazyImage.lazyObserver
      },
      {
        // 실제 스크롤 속도와 이미지 다운로드 시간을 보고 조정한다.
        rootMargin: '200px 0px',
      },
    )

    lazyImage.lazyObserver = observer
    observer.observe(el)
  },

  beforeUnmount(el) {
    const lazyImage = el as LazyImageElement
    lazyImage.lazyObserver?.disconnect()
    delete lazyImage.lazyObserver
  },
}
~~~

~~~vue
<template>
  <!-- src는 관찰 시점에 설정되지만, 크기는 처음부터 확보한다. -->
  <img
    v-lazy="'/images/comment-chart.webp'"
    width="960"
    height="540"
    alt="댓글 추이 차트"
  >
</template>
~~~

이미지 URL이 반응적으로 자주 바뀌는 UI라면 directive의 <code>updated</code> hook에서 다시 관찰하거나, URL을 key로 분리하는 정책도 필요합니다. 단순한 <code>img</code>에는 native lazy loading을 우선하고, 커스텀 observer는 실제로 제어가 필요한 목록에만 씁니다.

---

## 3. Preload, Fetch Priority, Prefetch, Preconnect 구분하기

세 기능은 이름이 비슷하지만 목적이 다릅니다. 가장 중요한 판단 기준은 **현재 페이지가 반드시 필요로 하는가**, 그리고 **브라우저가 이미 HTML에서 발견할 수 있는가**입니다.

| 기능 | 목적 | 요청 성격 | 대표 사용처 |
| :--- | :--- | :--- | :--- |
| <code>rel="preload"</code> | 현재 페이지의 늦게 발견되는 핵심 리소스를 일찍 요청 | 현재 탐색의 중요한 요청 | CSS background LCP 이미지, CSS <code>@import</code> 뒤 폰트 |
| <code>fetchpriority="high"</code> | 이미 요청될 리소스의 상대적 우선순위를 힌트로 조정 | 요청을 새로 만들지는 않음 | 검증된 LCP 이미지 한 개 |
| <code>rel="prefetch"</code> | 미래 탐색에서 쓸 가능성이 있는 리소스를 낮은 우선순위로 준비 | 브라우저가 무시·지연할 수 있는 추측 요청 | 높은 전환율의 다음 페이지 리소스 |
| <code>rel="preconnect"</code> | 다른 origin과의 DNS·연결·TLS 설정을 앞당김 | 개별 리소스를 받지는 않음 | 실제로 즉시 필요한 이미지·API·폰트 origin |

### 1) 늦게 발견되는 LCP 리소스만 preload

일반 <code>img</code>가 서버 HTML에 있다면 preload scanner가 이미 발견할 수 있으므로, 먼저 마크업을 바로 노출하는 편이 낫습니다. 반대로 CSS background image나 Hydration 뒤 삽입되는 리소스는 늦게 발견될 수 있어 preload가 유용합니다.

~~~html
<head>
  <!-- CSS에서 쓰는 실제 LCP background image를 선행 요청 -->
  <link
    rel="preload"
    as="image"
    href="/images/hero-1440.avif"
    imagesrcset="/images/hero-768.avif 768w, /images/hero-1440.avif 1440w"
    imagesizes="100vw"
    type="image/avif"
    fetchpriority="high"
  >

  <!-- 폰트 preload는 CORS 모드까지 실제 @font-face 요청과 일치시킨다. -->
  <link
    rel="preload"
    as="font"
    href="/fonts/brand-subset.woff2"
    type="font/woff2"
    crossorigin
  >
</head>
~~~

<code>as</code>, <code>type</code>, URL, <code>crossorigin</code>이 실제 사용 방식과 다르면 브라우저가 같은 파일을 두 번 받거나 preload가 낭비될 수 있습니다. 반응형 이미지는 <code>imagesrcset</code>과 <code>imagesizes</code>를 함께 써서 현재 뷰포트에 맞지 않는 원본을 먼저 받지 않게 합니다.

<code>preconnect</code>는 파일을 내려받는 기능이 아니라 다른 origin에 필요한 연결을 미리 여는 힌트입니다. 실제로 빠르게 사용할 origin 몇 개에만 적용하고, CORS 요청과 연결을 공유해야 하면 요청 방식에 맞는 <code>crossorigin</code>을 함께 둡니다.

~~~html
<!-- 실제 첫 화면에서 바로 쓰는 이미지 origin에만 적용한다. -->
<link rel="preconnect" href="https://images.example-cdn.com" crossorigin>
~~~

> [!CAUTION]
> preload는 강한 수단입니다. 쓰이지 않는 preload 경고가 Console에 보이거나, Network Waterfall에서 CSS·LCP 이미지보다 많은 요청과 경쟁한다면 제거합니다. LCP의 네 구간과 실제 후보 확인은 [Chapter 8](./chapter-8-core-web-vitals.md)에서 수행합니다.

### 2) 다음 탐색을 위한 prefetch는 보수적으로

<code>prefetch</code>는 현재 화면을 빠르게 만드는 기능이 아니라 **다음 탐색**을 위한 낮은 우선순위 힌트입니다. 사용자가 실제로 이동할 가능성이 높은 흐름, 유휴 대역폭, 비용이 낮은 chunk에서만 검토합니다. 빌드 산출물의 해시 URL을 수동으로 하드코딩하기보다, 프레임워크나 bundler가 제공하는 방법과 실제 빌드 manifest를 사용합니다.

---

## 4. Vue 3 / Nuxt 4 코드 분할

코드 분할은 초기 JavaScript의 다운로드·파싱·실행 비용을 줄이는 수단입니다. 모든 static import가 하나의 파일이 된다고 단정할 수는 없지만, 초기 경로에서 도달 가능한 모듈과 무거운 의존성이 많으면 첫 방문 비용이 커집니다. 먼저 [Chapter 2](./chapter-2-devtools.md)의 Coverage와 bundle analyzer로 큰 chunk와 의존성을 확인합니다.

### 1) 조건부 무거운 UI는 async component로 분리

<code>defineAsyncComponent()</code>의 loader는 해당 컴포넌트가 실제로 렌더링될 때 호출됩니다. 로딩·오류 상태와 레이아웃 공간까지 설계해야 첫 클릭에서 빈 화면이나 갑작스러운 밀림을 만들지 않습니다.

~~~vue
<script setup lang="ts">
import { defineAsyncComponent, ref } from 'vue'
import ModalLoadError from './ModalLoadError.vue'
import ModalLoading from './ModalLoading.vue'

const showCheckout = ref(false)

// warm-up 코드와 같은 loader를 공유하면 별도 import 경로가 생기지 않는다.
const loadCheckoutModal = () => import('./CheckoutModal.vue')

const CheckoutModal = defineAsyncComponent({
  loader: loadCheckoutModal,
  loadingComponent: ModalLoading,
  errorComponent: ModalLoadError,
  delay: 200,
  timeout: 10_000,
})
</script>

<template>
  <button @click="showCheckout = true">결제 창 열기</button>

  <!-- false인 동안에는 loader를 실행하지 않는다. -->
  <CheckoutModal v-if="showCheckout" />
</template>
~~~

작은 아이콘·자주 쓰는 메뉴·초기 화면의 UI까지 기계적으로 분리하면 요청 수와 전환 지연만 늘 수 있습니다. 기능의 크기, 사용 빈도, 첫 화면 필요 여부를 함께 봅니다.

### 2) Vue Router의 route-level code splitting

Vue Router의 route lazy loading은 async component와 별개의 기능입니다. route 정의에는 <code>defineAsyncComponent()</code>를 감싸지 말고 Promise를 반환하는 dynamic import를 직접 둡니다.

~~~typescript
import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../views/SettingsView.vue'),
    },
  ],
})
~~~

Nuxt 4의 <code>app/pages/</code>는 file-based route를 만들고, 컴포넌트 이름 앞의 <code>Lazy</code> prefix는 dynamic import를 만듭니다. 단 처음부터 렌더링되는 Lazy 컴포넌트는 여전히 일찍 로드될 수 있으므로, 필요한 경우 조건부 렌더링을 함께 사용합니다.

~~~vue
<script setup lang="ts">
const showAnalytics = ref(false)
</script>

<template>
  <button @click="showAnalytics = true">분석 패널 열기</button>
  <LazyAnalyticsPanel v-if="showAnalytics" />
</template>
~~~

Nuxt 4의 delayed hydration은 비핵심 컴포넌트에 유용하지만, 첫 클릭이 중요한 입력·결제 UI에는 비용을 미루는 결과가 될 수 있습니다. SSR·Hydration 선택과 Nuxt 전용 전략은 [Chapter 9](./chapter-9-vue-nuxt-web-vitals.md)에서 판단합니다.

---

## 5. 사용자 의도가 보일 때 chunk를 warm-up하기

초기 bundle을 줄였더라도 사용자가 모달·탭·다음 경로를 처음 열 때 chunk 다운로드가 시작되면 전환이 늦어질 수 있습니다. 클릭 전에 의도가 드러난 경우에만 같은 loader를 미리 호출합니다. 포인터뿐 아니라 키보드 focus도 처리해야 합니다.

~~~vue
<script setup lang="ts">
import { defineAsyncComponent, ref } from 'vue'

const showCheckout = ref(false)
const loadCheckoutModal = () => import('./CheckoutModal.vue')
const CheckoutModal = defineAsyncComponent(loadCheckoutModal)

function warmCheckoutModal() {
  // 실패해도 실제 렌더링 시 async component의 오류 UI가 처리한다.
  void loadCheckoutModal().catch(() => undefined)
}
</script>

<template>
  <button
    @pointerenter="warmCheckoutModal"
    @focus="warmCheckoutModal"
    @click="showCheckout = true"
  >
    결제 창 열기
  </button>

  <CheckoutModal v-if="showCheckout" />
</template>
~~~

이 패턴은 다운로드 완료를 보장하지 않습니다. 느린 연결·데이터 절약 모드·사용자 행동 변화에서는 요청이 낭비될 수 있으므로, 전환율이 높은 흐름에서만 적용하고 Network 패널과 RUM으로 효과를 확인합니다.

### 📋 로딩 전략 체크리스트

* [ ] LCP 후보가 초기 HTML에서 발견되고, <code>loading="lazy"</code>가 적용되지 않았는가?
* [ ] 모든 lazy 이미지와 iframe에 최종 크기 또는 종횡비를 예약했는가?
* [ ] preload가 현재 페이지의 늦게 발견되는 핵심 리소스에만 쓰였는가?
* [ ] preload의 <code>as</code>, <code>type</code>, <code>crossorigin</code>, 반응형 이미지 후보가 실제 요청과 일치하는가?
* [ ] route는 dynamic import를 직접 사용하고, 조건부 무거운 UI만 async component로 분리했는가?
* [ ] warm-up과 prefetch가 첫 화면의 네트워크 경쟁이나 데이터 낭비를 만들지 않는지 측정했는가?

### 📚 공식 참고 자료

* [Web.dev: Resource Hints](https://web.dev/learn/performance/resource-hints)
* [Web.dev: Preload Scanner](https://web.dev/articles/preload-scanner)
* [MDN: img의 loading 및 크기 예약](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/img)
* [Vue: Async Components](https://vuejs.org/guide/components/async.html)
* [Vue Router: Lazy Loading Routes](https://router.vuejs.org/guide/advanced/lazy-loading)
* [Nuxt 4: Components, Dynamic Imports, Lazy Hydration](https://nuxt.com/docs/4.x/directory-structure/app/components)
