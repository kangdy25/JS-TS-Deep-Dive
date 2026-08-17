# ⚡ 프론트엔드 성능 최적화 가이드 (Frontend Performance Optimization Guide)

현대 웹 애플리케이션에서 **성능(Performance)**은 사용자 경험(UX)과 비즈니스 성과에 직접 영향을 주는 핵심 요소입니다. 느린 로딩과 끊기는 상호작용은 이탈과 전환에 영향을 줄 수 있으며, Core Web Vitals는 검색 경험을 포함한 여러 신호 중 하나로 활용됩니다.

본 가이드는 본 프로젝트(`learning_project`)의 프론트엔드 성능 최적화 교과과정(Module 1 ~ Module 9)을 바탕으로 제작되었습니다. 각 챕터는 브라우저가 화면을 렌더링하는 기본 원리부터 분석 도구 활용, 에셋 캐싱, 비동기 로딩, GPU 하드웨어 가속, Vue.js 프레임워크 수준의 튜닝, 그리고 실제 사용자 경험을 기준으로 성능을 진단하는 **Web Vitals**까지의 실무 지식과 구체적인 코드 예시들을 상세하게 정리하여 제공합니다.

---

## 📂 목차 (Table of Contents)

### 📌 [Chapter 1: 브라우저 렌더링 원리 (CRP & Rendering Flow)](./chapter-1-rendering-basic.md)
* HTML parser·preload scanner·CSSOM이 첫 화면을 준비하는 흐름과, 변경마다 조건부로 발생하는 Style·Layout·Paint·Composite 비용을 이해합니다. `defer`/`async`/module script, forced synchronous layout, DOM read/write batching, 안정적인 공간 예약까지 브라우저 Trace로 검증하는 방법을 다룹니다.

### 📌 [Chapter 2: 성능 분석 도구 마스터하기 (DevTools & Lighthouse)](./chapter-2-devtools.md)
* URL·시나리오·캐시·throttle·브라우저·배포 버전을 고정한 측정 계약을 세우고, Chrome DevTools의 Interaction·Layout Shift·Insights·Network waterfall·Coverage를 함께 해석합니다. Lighthouse는 Lab 가설 생성과 회귀 확인에 쓰고, 실제 사용자 P75 판정은 Chapter 7로 연결합니다.

### 📌 [Chapter 3: 네트워크 리소스 및 캐시 최적화 (Compression & CDN)](./chapter-3-network-caching.md)
* 실제 transferred bytes를 기준으로 Brotli/gzip, `Vary: Accept-Encoding`, CDN variant cache를 검증합니다. 반응형 이미지·폰트·비디오의 전달 비용과 공간 예약을 다루고, 해시 정적 자산·일반 HTML·개인화·민감 응답에 맞는 HTTP 캐시 정책을 구분합니다.

### 📌 [Chapter 4: 로딩 패턴 및 프리로드 기법 (Lazy Loading & Code Splitting)](./chapter-4-loading-patterns.md)
* 현재 화면의 LCP 후보, 아래 폴드 리소스, 다음 탐색 후보를 구분해 native lazy loading·Intersection Observer·preload·prefetch·`fetchpriority`·`preconnect`를 선택합니다. Nuxt 4의 route-level splitting, `Lazy` component, async loading/error 상태, 의도 기반 warm-up의 이점과 비용을 다룹니다.

### 📌 [Chapter 5: 브라우저 렌더링 최적화 및 로직 개선 (Rendering & Execution Advanced)](./chapter-5-rendering-advanced.md)
* 화면 주사율별 frame budget 안에서 JS·Style·Layout·Paint·Composite 비용을 줄이는 전략을 다룹니다. `transform`/`opacity`와 제한적인 `will-change`, `content-visibility`/`contain-intrinsic-size`, 이벤트 취소·task yield·Worker 메시지 계약을 DevTools Trace로 검증합니다.

### 📌 [Chapter 6: Vue.js & 상태 관리 최적화 (Vue Reactivity & Cache)](./chapter-6-framework-tuning.md)
* Vue 3 반응성의 실제 비용 모델을 바탕으로 `ref`/`reactive`/shallow API/`markRaw`의 선택 기준과 갱신 규칙을 비교합니다. computed·watch·Pinia getter의 캐시 범위, 정규화된 상태, stable props·virtualization·안전한 `v-once`/`v-memo`로 업데이트 범위를 줄이는 방법을 다룹니다.

### 📌 [Chapter 7: Web Vitals와 웹 성능 측정 전략 (Lab & Field Data)](./chapter-7-web-vitals-measurement.md)
* **Web Vitals와 Core Web Vitals**의 역할 및 SEO와의 관계를 이해하고, Lighthouse 기반의 Lab Data와 CrUX/RUM 기반의 Field Data를 구분하여 실제 사용자 경험을 측정하는 분석 Workflow를 학습합니다.

### 📌 [Chapter 8: Core Web Vitals 심화 분석 (LCP, INP & CLS)](./chapter-8-core-web-vitals.md)
* 로딩 체감 속도를 결정하는 **LCP**, 사용자 조작 반응성을 측정하는 **INP**, 화면 안정성을 나타내는 **CLS**의 브라우저 측정 원리와 병목 원인, 그리고 서버·이미지·메인 스레드·레이아웃 관점의 개선 전략을 다룹니다.

### 📌 [Chapter 9: Vue/Nuxt Web Vitals 최적화 실전 (SSR, Hydration & Rendering)](./chapter-9-vue-nuxt-web-vitals.md)
* Vue 3 반응형 렌더링과 Nuxt의 SSR/SSG/Hydration 구조가 **LCP, INP, CLS**에 미치는 영향을 추적하고, 이미지·비동기 컴포넌트·이벤트 핸들러·동적 콘텐츠를 실제 코드로 개선하는 방법을 학습합니다.
