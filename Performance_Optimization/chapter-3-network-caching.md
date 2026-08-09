# 📌 Chapter 3: 네트워크 리소스 및 캐시 최적화 (Compression & CDN)

웹 서비스를 구성하는 정적 리소스(텍스트 파일, 이미지, 폰트, 동영상)의 용량을 혁신적으로 압축하고 브라우저 캐싱과 네트워크 전송 속도를 최대화하는 실무 원리와 공식을 다룹니다.

---

## 1. 텍스트 압축 기법 (Gzip과 Brotli)

HTML, CSS, JavaScript 파일은 본질적으로 텍스트 기반이므로 높은 압축 효율을 보입니다. 서버가 파일을 있는 그대로 보내지 않고 압축 전송을 적용하면 브라우저 수신 속도(Content Download)가 **70% 이상 단축**될 수 있습니다.

### 1) 대표 압축 알고리즘 비교
* **Gzip**: 과거부터 보편적으로 활용된 디플레이트(Deflate) 압축 방식입니다. 사실상 모든 웹서버와 브라우저가 지원합니다.
* **Brotli (br)**: 구글이 개발한 오픈소스 무손실 압축 포맷입니다. Gzip 대비 **약 17~25% 추가 압축 효율**을 보입니다. 텍스트 기반 정적 리소스(코드) 최적화에 탁월하며, 모던 브라우저와 웹서버 대부분이 기본 프로토콜 규격으로 지원합니다.

### 2) 서버 설정 및 압축 여부 검증
브라우저가 리소스를 Brotli로 정상 수신하는지는 개발자 도구 `Network` 패널의 `Response Headers`를 통해 검증합니다.

```http
// 1. 요청 헤더 (브라우저 -> 서버)
Accept-Encoding: gzip, deflate, br

// 2. 응답 헤더 (서버 -> 브라우저)
Content-Encoding: br  <-- Brotli 압축 포맷 전송 승인됨
```

---

## 2. 이미지 사이즈 최적화와 WebP/AVIF 변환

화면에 모바일 기준 300px 너비로 노출될 이미지 영역에 가로 3000px 규격의 무거운 DSLR 원본 이미지(PNG/JPG)를 로딩하면 불필요한 트래픽 낭비와 모바일 기기 RAM 낭비가 매우 극심해집니다.

### 1) 차세대 이미지 포맷 활용
* **WebP**: JPG/PNG와 유사한 시각 화질을 보존하면서 용량을 **25~35% 가량 단축**합니다. 투명도(알파 채널) 처리 및 애니메이션 대체가 가능해 모던 웹의 표준 포맷으로 통용됩니다.
* **AVIF**: WebP 대비 **약 20% 이상 추가 압축**이 가능한 초고효율 압축 포맷입니다. 고대비 디테일 뭉개짐이 적으나, 구형 디바이스/사파리와의 호환 확인이 필요하며 브라우저 디코딩 연산량이 좀 더 많습니다.

### 2) 반응형 이미지 분기 (`<picture>` & `srcset`)
뷰포트 너비나 해상도에 맞춤형 포맷 및 크기를 서빙하기 위해 HTML5 `<picture>` 요소와 `srcset` 속성을 바인딩합니다.

```html
<!-- picture 요소를 활용한 다중 포맷 호환 및 뷰포트 분기 적용 예시 -->
<picture>
  <!-- 1. AVIF 포맷 지원 기기용 분기 -->
  <source srcset="banner-large.avif 1200w, banner-medium.avif 800w" type="image/avif" sizes="(min-width: 800px) 50vw, 100vw">
  <!-- 2. WebP 포맷 지원 기기용 분기 -->
  <source srcset="banner-large.webp 1200w, banner-medium.webp 800w" type="image/webp" sizes="(min-width: 800px) 50vw, 100vw">
  <!-- 3. 차세대 포맷 미지원 브라우저용 Fallback -->
  <img src="banner-fallback.jpg" width="800" height="400" alt="메인 서비스 배너" loading="lazy" decoding="async">
</picture>
```

---

## 3. 이미지 CDN을 통한 동적 처리 최적화

**이미지 CDN (Content Delivery Network)**은 전 세계 분산 서버망을 활용한 캐싱 배포 기능뿐만 아니라, **실시간 이미지 가공/변환 파이프라인**을 제공하는 특화 서비스입니다. (예: AWS CloudFront, Cloudinary, Imgix 등)

### 1) 쿼리스트링 파라미터를 이용한 가공
서버에 해상도별 이미지를 일일이 수작업으로 준비/저장해 두지 않고, 하나의 원본 고화질 이미지를 이미지 CDN 주소로 매핑한 뒤 URL 파라미터(`w`, `h`, `f`, `q` 등)를 넘겨 즉각적이고 동적으로 변환 처리합니다.

```html
// 원본 이미지 주소 (5MB)
https://cdn.mysite.com/images/profile.png

// 300px 가로 크기 축소 + WebP 압축 포맷 변환 + 품질 80% 조절 요청 (45KB)
https://cdn.mysite.com/images/profile.png?w=300&format=webp&q=80
```

### 2) Vue.js 컴포넌트 동적 바인딩 가이드

```vue
<template>
  <img 
    :src="getOptimizedImageUrl(profileUrl, 150)" 
    alt="프로필 이미지"
    width="150"
    height="150"
  />
</template>

<script setup lang="ts">
const profileUrl = '/images/user_raw.png';

const getOptimizedImageUrl = (url: string, width: number) => {
  // 실제 서비스 환경에선 이미지 CDN 호스트 규칙 및 쿼리 파라미터를 조립
  return `https://cdn.mysite.com${url}?w=${width}&format=webp&q=85`;
};
</script>
```

---

## 4. 웹 폰트 최적화 (Subset, WOFF2, font-display)

웹 폰트 파일은 대개 한글 문자 집합 전체 음절을 포함하기에 용량이 수 MB에 육박합니다. 다운로드가 완료될 때까지 화면의 텍스트가 사라지는 **FOIT (Flash of Invisible Text)**나 시스템 폰트로 먼저 보여지다가 기본 스타일이 뒤늦게 튀어 렌더링되는 **FOUT (Flash of Unstyled Text)** 현상을 유발합니다.

### 1) 서브셋(Subset) 폰트 사용
한글 11,172자 중 평소 거의 쓰이지 않는 특수 조합 글자들을 대대적으로 제거하고, 일상에서 주로 사용되는 **2,350자** 완성형 글자들만 골라 모아 재패키징한 경량화 폰트 파일입니다. 파일 용량을 3MB에서 **200~300KB 수준으로 90% 가량 축소**시킵니다.

### 2) WOFF2 웹 포맷 적용
웹 환경에 최적화된 최신 압축 포맷인 **WOFF2** 형식을 최우선 순위로 로드하도록 폰트 선언부에 적용합니다.

### 3) CSS `font-display: swap` 설정
폰트가 브라우저에 다운로드되기 전에도 대체 시스템 기본 폰트(Sans-serif 등)를 즉각 노출하여 텍스트 가독성을 최선 확보한 뒤, 수신 완료 시 웹 폰트로 교체 결합합니다.

```css
@font-face {
  font-family: 'MyCustomFont';
  src: url('/fonts/custom-subset.woff2') format('woff2'),
       url('/fonts/custom-subset.woff') format('woff');
  font-weight: 400;
  font-style: normal;
  font-display: swap; /* 즉시 시스템 폰트로 렌더링 후 완료 시 폰트 스왑 */
}
```

---

## 5. 동영상 사이즈 압축 및 지연(Lazy) 로딩

움직이는 배너나 배경용 루프 비디오(움짤 GIF 대체용 등)는 웹 리소스 중 용량이 가장 큽니다. 아무런 설정 없이 무거운 배경 동영상이 구동되면 모바일 기기의 데이터를 대량 소진시키고 첫 화면 로딩 대역폭을 막아버립니다.

### 1) MP4/WebM 압축 규격 전환
* **WebM**: 구글이 개발한 포맷으로 압축 효율이 매우 우수하며 투명(Alpha) 비디오 채널을 지원합니다.
* **H.264 MP4**: 전 디바이스 하드웨어 가속 호환성을 지니므로 WebM 미지원 기기용 Fallback 리소스로 제공합니다.

### 2) Lazy Loading 및 `preload="none"`
사용자 화면(Viewport)에 비디오 플레이어가 노출되기 전에는 동영상 소스 버퍼링을 단 1바이트도 시작하지 않도록 제어해야 합니다. `preload="none"`을 선언하거나 Intersection Observer를 활용해 제어합니다.

### 3) `poster` 썸네일 탑재
비디오 로드 대기 동안 보여줄 스틸 이미지를 띄워 레이아웃 흔들림(CLS)을 제어하고 빈 화면 노출을 차단합니다.

```html
<!-- 최적화된 배경 비디오 마크업 예시 -->
<video 
  autoplay 
  muted 
  loop 
  playsinline 
  preload="none" 
  poster="/images/video-thumb.jpg"
>
  <source src="/videos/hero-bg.webm" type="video/webm" />
  <source src="/videos/hero-bg.mp4" type="video/mp4" />
</video>
```

---

## 6. 불필요한 CSS 제거와 캐시 최적화

### 1) 불필요한 CSS 제거 (PurgeCSS)
부트스트랩 등 CSS 프레임워크나 외부 컴포넌트 라이브러리 스타일 시트를 그대로 통합하면 정작 화면에 사용되는 룰은 5% 미만이더라도 브라우저는 CSSOM 파싱에 엄청난 오버헤드를 소비합니다. 빌드 툴체인(Vite, Webpack 등)에 **PurgeCSS** 플러그인을 활성화하여, 컴포넌트 템플릿 코드에 쓰이지 않는 스타일 코드들을 완전히 도려냅니다(Dead Code Elimination).

### 2) 캐시 최적화 (Cache-Control Headers)
* **정적 파일 (JS, CSS, 이미지)**: 모던 웹에서는 빌드 결과물에 고유한 해시 파일명(예: `index-e4c19a9d.js`)이 부여됩니다. 파일 내용이 바뀌지 않는 한 파일 이름도 바뀌지 않으므로, 브라우저가 최장 기간 무조건 로컬 캐시를 재활용하도록 유도합니다.
  * `Cache-Control: public, max-age=31536000, immutable`
* **HTML 문서 (index.html)**: 변경 사항 감지 및 배포 동기화를 위해, 매번 서버의 업데이트 여부 검증(Etag 등)을 거치게 제어합니다.
  * `Cache-Control: no-cache, no-store, must-revalidate`
