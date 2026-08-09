# 📌 Chapter 4: 로딩 패턴 및 프리로드 기법 (Lazy Loading & Code Splitting)

불필요한 리소스는 화면 노출 시점까지 로딩을 미루고(Lazy Load), 핵심 리소스는 우선순위를 올려 먼저 가져오며(Preload), 라우트와 컴포넌트 크기를 예측하여 분할(Code Splitting)하는 고급 로딩 아키텍처 패턴을 학습합니다.

---

## 1. 이미지 지연(Lazy) 로딩 구현

스크롤 하단에 존재하여 초기 로딩 화면에 나타나지 않는 이미지의 다운로드를 연기해 두었다가, 뷰포트 영역에 도달하기 직전 비동기 로딩을 개시하는 설계 패턴입니다.

### 1) 네이티브 `loading="lazy"` 속성
가장 대중적이며 표준 규격의 지연 로딩 방법입니다.
```html
<img src="footer-ad.jpg" loading="lazy" alt="하단 광고 배너">
```

### 2) Intersection Observer API 커스텀 디렉티브
네이티브 지연 로딩은 환경별 마진 거리가 달라 브라우저마다 로딩 개시 타이밍을 제어하기 어렵습니다. Vue.js 환경에서는 **커스텀 디렉티브(Custom Directive)**를 구현하여 감지 마진과 이미지 진입 시점 효과(예: 페이드인)를 명확하게 프로그래밍할 수 있습니다.

```typescript
// Vue 3 커스텀 디렉티브 (v-lazy) 구현 예시
import { Directive } from 'vue';

export const vLazy: Directive = {
  mounted(el: HTMLImageElement, binding: { value: string }) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          el.src = binding.value; // 실제 이미지 소스 로드
          observer.unobserve(el); // 감지 대상에서 제외 (단회성 로드)
        }
      });
    }, {
      rootMargin: '50px' // 뷰포트 진입 50px 전에 미리 다운로드 시작
    });

    observer.observe(el);
  }
};
```

---

## 2. 이미지 Preload를 통한 중요 정적 자원 선행 로딩

초기 뷰포트에 즉각 노출되어 LCP(Largest Contentful Paint)를 담당하는 메인 히어로 배너 등은, 브라우저가 DOM을 끝까지 읽고 스타일시트 파싱 및 렌더 트리 구성을 거쳐야 비로소 파일 다운로드가 트리거되므로 전송 타이밍이 매우 늦어집니다. 

이때 `<head>` 단에서 **Preload** 리소스 힌트를 지정하여 즉각적인 선행 다운로드를 촉진시킬 수 있습니다.

```html
<head>
  <!-- 다른 일반 정적 자원들보다 네트워크 대역폭 우선순위를 최고로 올려 즉시 내려받음 -->
  <link rel="preload" as="image" href="/images/main-hero.webp" type="image/webp">
</head>
```

> [!WARNING]
> 초기 화면 영역 밖에 있는 이미지나 비핵심 외부 폰트 등을 무분별하게 `preload`로 지정하면, 핵심 번들 스크립트(JS) 및 핵심 CSS 다운로드용 대역폭과 경쟁을 유발해 초기 렌더링 성능이 오히려 치명적으로 악화됩니다.

---

## 3. Vue 컴포넌트 지연(Lazy) 로딩 및 코드 분할

싱글 페이지 애플리케이션(SPA)은 애플리케이션 전체 소스 코드와 node_modules 패키지를 하나의 거대한 `app.js` 파일로 빌드하는 단점이 존재합니다. 이로 인해 사용자가 로그인 페이지만 방문해도 결제 페이지나 어드민 페이지 코드까지 모조리 내려받아 초기 로딩 시간이 크게 늘어납니다.

이 병목을 해결하기 위해 기능별로 쪼갠 물리적 서브 청크(Chunk) 파일을 컴포넌트/라우트 단위로 생성하여 필요시 로딩합니다.

### 1) 동적 비동기 컴포넌트 (`defineAsyncComponent`)
Vue 3는 비동기적으로 동적 임포트(`import()`)를 처리하는 `defineAsyncComponent` API를 지원합니다.

```vue
// ❌ 일반 임포트 (빌드 시점에 메인 chunk에 축적되어 무거워짐)
<script setup lang="ts">
import HugeModal from './HugeModal.vue';
</script>
```

```vue
// ⭕ 동적 비동기 컴포넌트 (별도 chunk 파일로 물리적 분리)
<script setup lang="ts">
import { defineAsyncComponent } from 'vue';

// 실제로 해당 컴포넌트가 렌더링을 타는 시점에 비동기 네트워크 다운로드 가동
const HugeModal = defineAsyncComponent(() => 
  import('./HugeModal.vue')
);
</script>
```

### 2) 라우터(Router) 수준의 코드 분할
가장 효과가 크고 보편적으로 쓰이는 분할 지점입니다. 라우트 전환이 일어나기 전까지는 타겟 페이지 코드가 전송되지 않습니다.

```typescript
const router = createRouter({
  routes: [
    {
      path: '/about',
      name: 'About',
      // 라우트 컴포넌트를 Dynamic import 형태로 선언
      component: () => import('../views/AboutView.vue')
    }
  ]
});
```

---

## 4. 컴포넌트 Preload 기법 (Hover / Link 기반)

지연 로딩(Lazy Loading)을 통해 번들 크기를 줄이면 초기 속도는 크게 개선되지만, 사용자가 버튼을 클릭하는 바로 그 순간 비동기 스크립트를 다운로드하기 시작하므로 네트워크 상태에 따라 **0.5초~2초 가량의 UI 상호작용 딜레이(UX 레이턴시)**가 발생해 불쾌한 조작감을 제공합니다.

이를 해결하기 위해 **"코드는 미리 물리적으로 쪼개두되, 사용자가 버튼을 클릭하기 일보 직전에 네트워크 몰래 조용히 캐시로 긁어다놓자"**는 개념이 컴포넌트 Preload 기법입니다.

### 1) 마우스 호버 기반 선제 다운로드 (Hover-based Preload)
사용자가 마우스를 버튼 위로 올리는(Hover, `mouseenter`) 액션이 발생하는 짧은 물리적 순간(보통 클릭하기 약 100~300ms 전)을 포착하여 동적 임포트 함수를 미리 수행합니다.

```vue
<template>
  <button 
    @mouseenter="preloadHugeModal" 
    @click="showModal = true"
  >
    모달 열기
  </button>
  <HugeModal v-if="showModal" />
</template>

<script setup lang="ts">
import { ref, defineAsyncComponent } from 'vue';

const HugeModal = defineAsyncComponent(() => import('./HugeModal.vue'));
const showModal = ref(false);

// 마우스 진입 감지 즉시 비동기 파일 다운로드 트리거
const preloadHugeModal = () => {
  // dynamic import 함수를 호출하여 브라우저 메모리/디스크 캐시 저장소에 선박
  import('./HugeModal.vue');
};
</script>
```

### 2) Link / Router-link Prefetch
화면 전체 그리기가 일단 끝나 브라우저가 유휴 상태(Idle)가 되면 `link rel="prefetch"` 태그를 헤드 영역에 임시 삽입하여, 차순위로 유입될 것이 예상되는 미래 경로 청크를 낮은 우선순위 네트워크 대역폭으로 수신하여 캐싱해 둡니다.
