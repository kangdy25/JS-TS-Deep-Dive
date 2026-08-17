# 📌 Chapter 3: 네트워크 리소스 및 캐시 최적화 (Compression & CDN)

네트워크 최적화의 목표는 "가장 작은 파일" 하나가 아닙니다. 사용자가 실제로 내려받는 바이트, 캐시 적중 여부, 이미지의 표시 크기, 디코딩 비용, 리소스를 발견한 시점이 함께 첫 화면과 상호작용을 결정합니다. 따라서 포맷·압축률의 고정 숫자 대신 **배포된 응답을 Network 패널에서 측정**하는 습관이 중요합니다.

리소스 발견과 `preload`·`prefetch` 우선순위는 [Chapter 4](./chapter-4-loading-patterns.md), LCP 리소스와 폰트가 Web Vitals에 미치는 영향은 [Chapter 8](./chapter-8-core-web-vitals.md)에서 이어서 다룹니다.

---

## 1. 먼저 무엇을 측정하는지 구분하기

### 1) 파일 크기에는 여러 의미가 있다

| 용어 | 확인 위치 | 의미 |
| :--- | :--- | :--- |
| 원본 크기 | 빌드 산출물·이미지 원본 | 배포 전 파일 자체의 크기 |
| encoded 크기 | Response Headers의 `Content-Length` 등 | 압축·인코딩된 응답 본문의 크기일 수 있음 |
| transferred bytes | DevTools Network의 Size·Timing | 이번 요청에서 실제 네트워크를 통해 전송된 양 |
| decoded / render 비용 | Performance Trace, 기기 관찰 | 받은 이미지·폰트·스크립트를 해석하고 그리는 비용 |

캐시에서 재사용된 리소스는 transferred bytes가 매우 작거나 0처럼 보일 수 있습니다. 이것은 첫 방문이 가볍다는 뜻이 아니라 **재방문 경로가 캐시를 사용했다**는 뜻입니다. 성능 보고서에는 cold load와 warm load를 구분해 기록합니다.

### 2) Network 패널의 최소 확인 절차

1. 대상 페이지를 cache를 켠 상태와 Disable cache 상태에서 각각 로드합니다.
2. `Size`, `Priority`, `Initiator`, `Protocol` 열을 켭니다.
3. 큰 요청을 열어 `Content-Encoding`, `Cache-Control`, `ETag`, `Vary`를 확인합니다.
4. 뷰포트·DPR·네트워크 조건을 바꿔 이미지 후보와 전송량이 실제로 달라지는지 확인합니다.
5. 바이트가 줄었더라도 LCP·INP가 나빠지지 않았는지 Performance Trace와 [Chapter 7](./chapter-7-web-vitals-measurement.md)의 Field Data로 검증합니다.

---

## 2. 텍스트 압축과 CDN variant cache

### 1) Brotli와 gzip은 응답 협상의 결과다

HTML, CSS, JavaScript, JSON, SVG처럼 반복되는 텍스트는 보통 content encoding의 효과가 큽니다. `br`(Brotli)와 `gzip` 중 어느 쪽이 더 작을지는 파일 종류·크기·압축 수준에 따라 다르므로, "Brotli가 항상 몇 % 더 작다"고 가정하지 않습니다.

이미 압축된 JPEG, WebP, AVIF, MP4 같은 바이너리를 다시 gzip/Brotli로 압축해도 이득이 작거나 CPU 비용만 늘 수 있습니다. 플랫폼의 기본 정책을 바꾸기 전에 실제 응답 헤더와 전송 크기를 비교합니다.

```http
# 브라우저 요청: 가능한 인코딩을 알린다.
Accept-Encoding: br, gzip, deflate

# 같은 URL에 여러 인코딩을 제공하는 origin/CDN의 응답 예시
Content-Encoding: br
Vary: Accept-Encoding
```

`Vary: Accept-Encoding`은 같은 URL이라도 요청의 `Accept-Encoding` 값에 따라 응답이 달라짐을 cache에 알립니다. 즉 CDN·공유 cache가 Brotli 응답과 gzip 응답을 같은 항목으로 잘못 재사용하지 않도록 variant를 구분합니다. CDN이 이미 이를 관리하는 경우도 있으므로, 적용 여부는 실제 response header와 cache 동작으로 확인합니다.

### 2) 압축 검증 체크포인트

| 확인 항목 | 좋은 질문 |
| :--- | :--- |
| `Content-Encoding` | 텍스트 응답이 의도한 인코딩으로 내려오는가? |
| `Vary` | 콘텐츠 협상 응답이 cache key에 필요한 request header를 반영하는가? |
| `Content-Type` | SVG·JSON·JS가 예상 타입으로 전달되는가? |
| `Size` | 추정 bundle 크기가 아니라 실제 transferred bytes가 줄었는가? |
| CPU | 압축 해제·JS 파싱이 느린 기기에서 다른 병목을 만들지 않는가? |

---

## 3. 반응형 이미지는 표시 크기와 목적부터 결정한다

### 1) 포맷은 호환성·화질·디코딩까지 포함해 선택한다

WebP와 AVIF는 많은 사진에 좋은 선택지가 될 수 있지만, 모든 이미지와 모든 기기에서 같은 결과를 내지는 않습니다. 동일한 시각 품질에서의 전송 바이트, 저사양 기기의 decode 시간, 지원 범위를 실제 대표 이미지로 비교합니다. 로고·아이콘처럼 벡터가 적합한 자산은 SVG가 더 나을 수 있습니다.

`<picture>`는 **포맷 fallback**과 **art direction**에, `srcset`과 `sizes`는 브라우저가 표시 조건에 맞는 후보를 고르는 데 사용합니다. 첫 화면 Hero라면 `loading="lazy"`를 붙이지 않습니다.

```html
<!-- 첫 화면 Hero: 실제 CSS 표시 폭에 맞게 sizes를 작성한다. -->
<picture>
  <source
    type="image/avif"
    srcset="/images/hero-768.avif 768w, /images/hero-1280.avif 1280w, /images/hero-1920.avif 1920w"
    sizes="(min-width: 1024px) 960px, 100vw"
  >
  <source
    type="image/webp"
    srcset="/images/hero-768.webp 768w, /images/hero-1280.webp 1280w, /images/hero-1920.webp 1920w"
    sizes="(min-width: 1024px) 960px, 100vw"
  >
  <img
    src="/images/hero-1280.jpg"
    srcset="/images/hero-768.jpg 768w, /images/hero-1280.jpg 1280w, /images/hero-1920.jpg 1920w"
    sizes="(min-width: 1024px) 960px, 100vw"
    width="1920"
    height="1080"
    alt="새 컬렉션 대표 이미지"
  >
</picture>
```

`sizes`를 실제 CSS 폭과 다르게 쓰면 브라우저가 너무 큰 후보를 고르거나, 작은 이미지를 확대한 결과를 낼 수 있습니다. DevTools의 Network에서 선택된 URL과 실제 렌더링 크기를 함께 확인합니다.

### 2) LCP 이미지와 아래 폴드 이미지를 분리한다

| 위치·목적 | 기본 전략 | 피해야 할 것 |
| :--- | :--- | :--- |
| 첫 화면의 LCP 후보 | 초기 HTML에서 `src`/`srcset`을 발견, 크기 예약, 필요한 경우 우선순위 검토 | `loading="lazy"`, JavaScript 응답 뒤에 URL 생성 |
| 화면 아래의 카드 썸네일 | 적절한 `srcset`·`sizes`, `loading="lazy"`, 크기 예약 | 원본 고해상도 이미지를 모든 카드에 고정 전달 |
| 다음 화면에서만 쓰는 이미지 | route·사용자 의도에 맞춰 나중에 요청 | 현재 화면의 LCP와 대역폭 경쟁 |

```html
<!-- 아래 폴드의 카드 이미지: lazy여도 공간은 먼저 확보한다. -->
<img
  src="/images/product-480.webp"
  srcset="/images/product-320.webp 320w, /images/product-480.webp 480w, /images/product-720.webp 720w"
  sizes="(min-width: 768px) 240px, 50vw"
  width="720"
  height="540"
  loading="lazy"
  alt="상품 이미지"
>
```

이미지의 `width`·`height` 또는 정확한 CSS `aspect-ratio`는 lazy 여부와 별개로 레이아웃 공간을 예약합니다. CLS 원인과 Nuxt Hydration의 관계는 [Chapter 8](./chapter-8-core-web-vitals.md)~[Chapter 9](./chapter-9-vue-nuxt-web-vitals.md)를 참고합니다.

---

## 4. 일반 CDN과 이미지 변환 서비스를 구분하기

일반 CDN의 핵심 역할은 origin에서 받은 응답을 사용자 가까운 cache에서 전달하는 것입니다. 반면 이미지 변환 서비스는 리사이즈, crop, format, quality 같은 **파생 이미지 생성**과 그 결과의 cache를 추가로 제공합니다. 두 기능은 함께 제공될 수 있지만 같은 개념은 아닙니다.

| 구분 | 확인할 내용 |
| :--- | :--- |
| 일반 CDN | cache hit, origin 응답 시간, 지역별 전달, HTTP cache header 유지 |
| 이미지 변환 | 허용한 너비·포맷·품질 조합, 변환 결과 cache, 원본 접근 제어 |
| URL 파라미터 | 공급자별 문법과 cache key가 다름. 임의의 `?w=...`가 어디서나 동작하지 않음 |

Nuxt Image를 쓰면 provider 설정에 맞춰 이미지 URL을 만들고, 컴포넌트에 표시 크기와 `sizes`를 명시할 수 있습니다. 아래 코드는 provider별 URL 문법을 직접 조립하지 않는 사용 예입니다.

```vue
<template>
  <NuxtImg
    :src="product.image"
    :alt="product.name"
    width="640"
    height="480"
    sizes="100vw lg:320px"
    format="webp"
  />
</template>

<script setup lang="ts">
const product = {
  name: '무선 키보드',
  image: '/products/keyboard.jpg',
};
</script>
```

이 예제의 `format`은 전달 규칙의 한 예일 뿐입니다. 실제 provider가 AVIF fallback, 원격 도메인, 변환 허용 폭을 어떻게 설정했는지 확인하고, Network에서 선택된 최종 URL·응답 헤더·캐시를 검증합니다.

---

## 5. 웹 폰트는 가독성과 레이아웃 안정성의 균형이다

### 1) 필요한 글리프와 weight만 전달하기

폰트 파일 크기는 언어, 문자 범위, weight·style 수, variable font 축에 따라 크게 달라집니다. 실제 화면에 쓰는 언어와 weight를 조사한 뒤 subset 또는 `unicode-range` 분할을 검토합니다. 사용하지 않는 굵기까지 모두 preload하거나 초기 CSS에 선언하면 네트워크와 CSSOM 비용이 늘어납니다.

WOFF2는 현대 브라우저용 웹 폰트 전송에 널리 쓰이는 형식입니다. fallback이 필요한 서비스는 지원 대상에 맞춰 별도 소스를 두되, 실제 브라우저 비율을 보고 결정합니다.

### 2) `font-display`의 trade-off

| 값 | 주된 사용자 경험 | 주의점 |
| :--- | :--- | :--- |
| `swap` | fallback 텍스트를 빨리 보여 준 뒤 웹 폰트로 교체 | 글자 폭이 다르면 FOUT와 CLS가 생길 수 있음 |
| `optional` | 느린 조건에서는 fallback을 유지할 수 있음 | 브랜드 폰트가 항상 적용된다는 보장은 줄어듦 |
| `fallback` | 짧은 대기 뒤 fallback을 보여 줌 | 네트워크 조건에 따른 교체를 실제 기기에서 확인 |
| `block` | 잠시 텍스트를 숨길 수 있음 | FOIT가 가독성과 LCP에 불리할 수 있음 |

```css
@font-face {
  font-family: 'App Sans';
  src: url('/fonts/app-sans-subset.woff2') format('woff2');
  font-weight: 400 700;
  font-style: normal;
  font-display: swap;
}

/* 수치는 대상 웹 폰트와 fallback을 비교해 조정하는 예시다. */
@font-face {
  font-family: 'App Sans Fallback';
  src: local('Arial');
  size-adjust: 92%;
  ascent-override: 90%;
  descent-override: 22%;
  line-gap-override: 0%;
}

body {
  font-family: 'App Sans', 'App Sans Fallback', sans-serif;
}
```

`size-adjust`, ascent/descent/line-gap override는 fallback의 글자 폭·행 높이를 목표 폰트에 가깝게 만드는 수단입니다. 위 수치는 복사할 정답이 아닙니다. 한글·영문 혼합, 실제 제목 길이, 여러 화면 폭에서 줄바꿈과 Layout Shift를 비교해 조정합니다. 초기 화면에서 꼭 필요한 폰트만 preload할지의 판단은 [Chapter 4](./chapter-4-loading-patterns.md)에서 다룹니다.

---

## 6. 비디오는 codec, container, 재생 정책을 따로 본다

`MP4`, `WebM`은 흔히 **container**를 가리키며, H.264, AV1, VP9 같은 것은 **codec**입니다. 재생 가능 여부와 전송 효율은 container 이름 하나로 결정되지 않습니다. 지원 브라우저, 하드웨어 decode, 화질, bitrate를 대표 기기에서 검증하고 적절한 source fallback을 제공합니다.

| 사용 사례 | 권장 출발점 |
| :--- | :--- |
| 사용자가 재생하는 아래 폴드 영상 | `preload="metadata"` 또는 `none`을 검토하고 poster·컨트롤 제공 |
| 무음 배경 루프 | `muted`, `playsinline`, `loop`을 포함해 autoplay 정책을 테스트하고 데이터 비용을 별도 검토 |
| 첫 화면의 핵심 영상 | LCP·대역폭 경쟁을 먼저 측정. `preload="none"`과 autoplay를 무조건 함께 쓰지 않음 |

```html
<video
  width="1280"
  height="720"
  controls
  preload="metadata"
  poster="/videos/demo-poster.webp"
>
  <source src="/videos/demo.webm" type="video/webm">
  <source src="/videos/demo.mp4" type="video/mp4">
  브라우저가 비디오 재생을 지원하지 않습니다.
</video>
```

`preload`는 브라우저에 주는 힌트이며 다운로드를 절대적으로 보장하거나 차단하지 않습니다. `poster`는 빈 화면을 줄이는 데 도움이 되지만 혼자서 공간을 예약하지는 않습니다. `width`·`height` 또는 `aspect-ratio`로 비디오 shell의 최종 비율을 확보합니다.

---

## 7. CSS 전송량도 실행 경로와 함께 줄인다

사용하지 않는 CSS는 전송량뿐 아니라 Style 계산에 영향을 줄 수 있습니다. CSS 제거 도구를 사용할 때에는 템플릿에 문자열로 드러나지 않는 동적 class, CMS 콘텐츠, 애니메이션 상태 class를 safelist에 포함하고, 모든 주요 화면·상태를 시각 회귀 테스트로 확인합니다.

```vue
<template>
  <!-- 'status-success'처럼 런타임에 조합되는 class는 제거 도구가 놓칠 수 있다. -->
  <p :class="`status-${status}`">{{ message }}</p>
</template>

<script setup lang="ts">
const status = 'success';
const message = '저장되었습니다.';
</script>
```

제거 도구의 결과가 작아졌더라도, 실제 route에서 스타일이 사라지지 않았는지 먼저 확인합니다. 초기 CSS와 route별 CSS 분할의 균형은 [Chapter 4](./chapter-4-loading-patterns.md)의 code splitting 검증과 함께 판단합니다.

---

## 8. 응답 성격별 HTTP cache 정책

`Cache-Control`은 "캐시한다 / 안 한다"의 이분법이 아닙니다. URL이 내용 변경 때 함께 바뀌는지, 응답이 개인화되는지, 민감 정보인지에 따라 정책을 나눕니다.

| 응답 종류 | 예시 정책 | 핵심 이유 |
| :--- | :--- | :--- |
| 내용 해시가 포함된 정적 자산 | `public, max-age=31536000, immutable` | 내용이 바뀌면 URL도 바뀌므로 장기 재사용 가능 |
| 일반 HTML·해시 없는 API | `no-cache` + `ETag` / `Last-Modified` | 재사용 전 검증하고, 변경 없으면 `304 Not Modified` 가능 |
| 개인화 HTML·응답 | `private, no-cache` | 공유 cache 누출을 막고 사용자별 최신 검증 |
| 매우 민감한 응답 | `no-store` | 저장 자체를 피해야 하는 특별한 경우 |

```http
# 내용 해시가 포함된 정적 파일
Cache-Control: public, max-age=31536000, immutable

# 일반 HTML: 저장은 가능하지만 재사용 전 검증한다.
Cache-Control: no-cache
ETag: "release-2026-08-17"
Last-Modified: Mon, 17 Aug 2026 02:00:00 GMT

# 로그인한 사용자별 HTML 또는 API 응답
Cache-Control: private, no-cache
```

`no-cache`는 저장을 금지하는 뜻이 아니라 **재사용 전에 검증하라**는 뜻입니다. 무조건 `no-store`를 붙이면 재검증과 back/forward cache 같은 브라우저 이점을 잃을 수 있습니다. 정말 저장하면 안 되는 민감한 응답에만 사용합니다.

`Vary`는 콘텐츠 협상에 필요한 헤더만 추가합니다. 특히 `User-Agent`처럼 값의 종류가 매우 많은 헤더를 `Vary`에 넣으면 cache 재사용률이 크게 떨어질 수 있습니다. 개인화 응답은 보통 `Vary: Cookie`에 의존하기보다 `private` 정책을 우선 검토합니다.

### ✅ 에셋·캐시 검증 체크리스트

* [ ] cold load와 warm load의 transferred bytes를 따로 기록했는가?
* [ ] 텍스트 응답의 `Content-Encoding`과 `Vary: Accept-Encoding`을 실제 header로 확인했는가?
* [ ] 이미지 `sizes`가 실제 CSS 표시 폭과 일치하는가?
* [ ] LCP 이미지를 lazy loading하지 않았는가?
* [ ] 폰트 fallback 교체가 실제 문장·화면 폭에서 줄바꿈을 바꾸지 않는가?
* [ ] 비디오에 poster뿐 아니라 명시적 크기 또는 종횡비가 있는가?
* [ ] 해시 자산, HTML, 개인화, 민감 응답에 서로 다른 cache 정책을 적용했는가?

### 📚 공식 참고 자료

* [MDN: HTTP 캐싱 가이드](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching)
* [MDN: `Vary` 헤더](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Vary)
* [Web.dev: 반응형 이미지](https://web.dev/learn/images/descriptive)
* [Web.dev: LCP 최적화](https://web.dev/articles/optimize-lcp)
* [MDN: `font-display`](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/font-display)
* [MDN: `size-adjust`](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/size-adjust)
* [Nuxt Image `NuxtImg`](https://image.nuxt.com/usage/nuxt-img)
