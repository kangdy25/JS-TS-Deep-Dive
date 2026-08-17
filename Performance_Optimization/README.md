# ⚡ 프론트엔드 성능 최적화 가이드 (Frontend Performance Optimization Guide)

현대 웹 애플리케이션에서 **성능(Performance)**은 사용자 경험(UX)과 비즈니스 성공을 결정짓는 핵심 요소입니다. 느린 로딩 속도와 끊기는 화면 전환은 사용자 이탈률을 높이고 검색 엔진 최적화(SEO) 점수를 저하시킵니다.

본 가이드는 본 프로젝트(`learning_project`)의 프론트엔드 성능 최적화 교과과정(Module 1 ~ Module 9)을 바탕으로 제작되었습니다. 각 챕터는 브라우저가 화면을 렌더링하는 기본 원리부터 분석 도구 활용, 에셋 캐싱, 비동기 로딩, GPU 하드웨어 가속, Vue.js 프레임워크 수준의 튜닝, 그리고 실제 사용자 경험을 기준으로 성능을 진단하는 **Web Vitals**까지의 실무 지식과 구체적인 코드 예시들을 상세하게 정리하여 제공합니다.

---

## 📂 목차 (Table of Contents)

### 📌 [Chapter 1: 브라우저 렌더링 원리 (CRP & Rendering Flow)](./chapter-1-rendering-basic.md)
* 브라우저가 HTML, CSS, JavaScript를 로드하여 화면에 그리는 중요 렌더링 경로(**CRP**)의 6단계 프로세스를 상세히 학습하고, 렌더링 속도에 직접적인 병목을 일으키는 **Reflow**와 **Repaint**의 차이 및 비용을 최소화하는 CSS 프로퍼티 매핑 기법을 다룹니다.

### 📌 [Chapter 2: 성능 분석 도구 마스터하기 (DevTools & Lighthouse)](./chapter-2-devtools.md)
* 크롬 개발자 도구의 **Performance 패널**을 활용해 CPU 스로틀링 환경에서 런타임 성능을 실시간 분석하고 **Long Task**를 역추적하는 기법을 배웁니다. 또한 **Lighthouse**를 활용하여 핵심 사용자 지표인 **Core Web Vitals (LCP, INP, CLS)**를 모니터링하고 분석하는 요령을 터득합니다.

### 📌 [Chapter 3: 네트워크 리소스 및 캐시 최적화 (Compression & CDN)](./chapter-3-network-caching.md)
* 웹 리소스를 최상의 압축률로 서빙하기 위한 **Gzip 및 Brotli** 알고리즘 비교와 서버 설정 확인법을 학습합니다. 또한 대용량 이미지를 모던 포맷(**WebP/AVIF**)과 반응형 마크업(**srcset, picture**)으로 변환하고, **이미지 CDN**의 동적 파라미터를 활용해 트래픽을 아끼는 실무 공식을 다룹니다.

### 📌 [Chapter 4: 로딩 패턴 및 프리로드 기법 (Lazy Loading & Code Splitting)](./chapter-4-loading-patterns.md)
* 뷰포트 내부로 리소스가 들어올 때까지 다운로드를 지연시키는 **Intersection Observer 이미지 지연(Lazy) 로딩**의 구현과 핵심 자원의 선행 다운로드를 유도하는 **Preload** 기법을 다룹니다. 아울러 Vue 비동기 컴포넌트(`import()`)를 이용한 **라우트 레벨 코드 분할**과 Vite 번들 분석(Visualizer) 적용법을 익힙니다.

### 📌 [Chapter 5: 브라우저 렌더링 최적화 및 로직 개선 (Rendering & Execution Advanced)](./chapter-5-rendering-advanced.md)
* **GPU 하드웨어 가속**의 장점과 `will-change` 사용 시 발생할 수 있는 메모리 누수 한계를 분석합니다. 갑작스러운 화면 밀림을 막는 **스켈레톤 UI, aspect-ratio, content-visibility**의 적용법, 그리고 메인 스레드 점유를 제어하는 **Debounce/Throttle 및 Web Worker** 오프로딩을 학습합니다.

### 📌 [Chapter 6: Vue.js & 상태 관리 최적화 (Vue Reactivity & Cache)](./chapter-6-framework-tuning.md)
* Vue 3 반응형 프록시의 깊은 관찰(Deep Observation) 오버헤드를 우회하기 위한 **shallowRef 및 shallowReactive** 활용 코드를 대조 분석합니다. 또한 Pinia/Computed의 **캐싱 구조** 원리를 이해하고, 게터에 인자를 전달할 때 발생하는 캐시 소실 현상을 극복하기 위한 **Map 매핑 구조** 개선 대안을 살펴봅니다.

### 📌 [Chapter 7: Web Vitals와 웹 성능 측정 전략 (Lab & Field Data)](./chapter-7-web-vitals-measurement.md)
* **Web Vitals와 Core Web Vitals**의 역할 및 SEO와의 관계를 이해하고, Lighthouse 기반의 Lab Data와 CrUX/RUM 기반의 Field Data를 구분하여 실제 사용자 경험을 측정하는 분석 Workflow를 학습합니다.

### 📌 [Chapter 8: Core Web Vitals 심화 분석 (LCP, INP & CLS)](./chapter-8-core-web-vitals.md)
* 로딩 체감 속도를 결정하는 **LCP**, 사용자 조작 반응성을 측정하는 **INP**, 화면 안정성을 나타내는 **CLS**의 브라우저 측정 원리와 병목 원인, 그리고 서버·이미지·메인 스레드·레이아웃 관점의 개선 전략을 다룹니다.

### 📌 [Chapter 9: Vue/Nuxt Web Vitals 최적화 실전 (SSR, Hydration & Rendering)](./chapter-9-vue-nuxt-web-vitals.md)
* Vue 3 반응형 렌더링과 Nuxt의 SSR/SSG/Hydration 구조가 **LCP, INP, CLS**에 미치는 영향을 추적하고, 이미지·비동기 컴포넌트·이벤트 핸들러·동적 콘텐츠를 실제 코드로 개선하는 방법을 학습합니다.
