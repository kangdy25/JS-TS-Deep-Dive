# 📌 Chapter 6: Vue.js 반응성·상태 관리 최적화 (Vue Reactivity & Cache)

Vue는 일반적인 애플리케이션 규모에서 이미 충분히 빠릅니다. 최적화의 출발점은 반응형 API를 무조건 얕게 바꾸는 일이 아니라, **어떤 데이터가 자주 바뀌고, 어떤 계산이 반복되며, 어떤 컴포넌트가 다시 렌더링되는지**를 구분하는 것입니다. 이 장에서는 Vue 3 반응성의 비용 모델, Pinia의 파생 상태 캐시, 큰 목록의 업데이트 범위 제어를 다룹니다.

> [!IMPORTANT]
> 이 장은 Vue와 Pinia의 메커니즘을 설명합니다. 상태 갱신이 INP에 미치는 영향과 Nuxt 4의 SSR·Hydration 전략은 [Chapter 9](./chapter-9-vue-nuxt-web-vitals.md)에서 실제 사용자 지표와 함께 분석합니다.

---

## 1. 반응형 비용을 이해하고 shallow API를 선택하기

Vue의 <code>reactive()</code>는 Proxy로 객체 접근을 추적하고, <code>ref()</code>는 값 컨테이너로 동작합니다. 객체를 담은 ref도 깊은 반응성의 이점을 얻지만, 비용은 객체를 대입하는 순간 모든 중첩 객체를 한꺼번에 순회해서라기보다, 대규모 nested data를 읽고 렌더링하면서 발생하는 proxy trap과 의존성 추적에서 두드러집니다.

| API | 반응형 범위 | 알맞은 경우 | 핵심 주의점 |
| :--- | :--- | :--- | :--- |
| <code>ref</code> / <code>reactive</code> | 기본적으로 깊은 객체 접근 추적 | 일반적인 변경 가능한 UI state | 측정 없이 shallow API로 바꾸지 않기 |
| <code>shallowRef</code> | <code>.value</code> 교체만 추적 | 큰 immutable 배열, 외부 라이브러리 instance | 내부 변경 뒤에는 자동 갱신되지 않음 |
| <code>shallowReactive</code> | 최상위 속성만 추적 | root 속성 단위로 교체하는 특수 state | 깊은 reactive tree 안에 섞으면 모델이 혼란스러움 |
| <code>markRaw</code> | 대상 root를 proxy 변환에서 제외 | 지도·차트 같은 복잡한 class instance | raw/proxy identity를 섞지 않기 |

Vue 성능 가이드에서 말하는 large immutable structure는 한 번의 렌더링이 수만 개 이상의 nested property에 접근하는 특수한 경우에 가깝습니다. API 응답이 크다는 이유만으로 바꾸지 말고, Vue Devtools와 Performance Trace에서 실제 렌더링·tracking 비용을 확인합니다.

### 1) 큰 immutable data는 root 교체로 갱신하기

다음 예시는 큰 차트 데이터를 읽기 위주로 사용하고, 새 응답이 왔을 때 전체 참조를 교체하는 경우입니다.

~~~typescript
import { shallowRef, triggerRef } from 'vue'

type ChartPoint = {
  timestamp: number
  value: number
}

const chartData = shallowRef<ChartPoint[]>([])

function replaceChartData(next: ChartPoint[]) {
  // ⭕ 새 배열 참조를 넣으면 의존 컴포넌트가 갱신된다.
  chartData.value = next
}

function appendPoint(point: ChartPoint) {
  // ❌ 이것만으로는 shallowRef를 읽는 view가 갱신되지 않는다.
  chartData.value.push(point)

  // 드물게 내부 변경을 허용해야 할 때만 명시적으로 알린다.
  triggerRef(chartData)
}
~~~

가능하면 내부 변경과 <code>triggerRef()</code>보다 immutable root replacement를 기본 규칙으로 삼습니다. 업데이트 시점이 명확하고, 이전 값과 새 값을 비교·디버깅하기 쉽습니다.

### 2) 외부 class instance는 raw 상태로 보관하기

지도·차트·에디터 객체처럼 Vue가 내부 property를 추적할 필요가 없는 class instance는 raw로 보관합니다.

~~~typescript
import { markRaw, shallowRef } from 'vue'

type MapInstance = {
  destroy: () => void
}

const map = shallowRef<MapInstance | null>(null)

function attachMap(element: HTMLElement) {
  const instance = createMapLibraryInstance(element)
  map.value = markRaw(instance)
}
~~~

<code>markRaw()</code>는 root 수준의 opt-out입니다. raw object의 nested object를 별도로 깊은 reactive state에 넣으면 proxy 버전과 raw 버전이 공존할 수 있으므로, 외부 instance는 하나의 shallow wrapper 안에서만 다루는 편이 안전합니다.

---

## 2. Pinia Getter·Computed의 캐시 범위를 설계하기

캐시는 하나의 기능이 아닙니다. Vue computed는 의존성 기반의 **파생 값 캐시**, Pinia getter는 store state 기반 computed, HTTP cache는 네트워크 응답 캐시, KeepAlive는 component instance 캐시입니다. 서로 다른 문제를 같은 "캐싱"으로 해결하려 하면 무효화와 메모리 정책이 흐려집니다.

### 1) Pinia getter는 인자 없는 파생 값에 가장 잘 맞는다

Pinia getter는 store state의 computed 값과 동등합니다. state 의존성이 바뀌기 전까지 같은 getter 결과를 재사용할 수 있습니다. 하지만 getter가 함수를 반환해 인자를 받는 형태는, 반환한 함수를 호출할 때마다 lookup 로직이 실행됩니다.

~~~typescript
// ❌ 호출마다 find()가 다시 실행된다.
getters: {
  getUserById: (state) => {
    return (id: string) => state.users.find((user) => user.id === id)
  },
}
~~~

읽기가 많고 전체 users 배열 변경이 드문 경우에는 Map을 파생 getter로 만들 수 있습니다. Map 자체는 users 의존성이 무효화된 뒤 다시 접근할 때 O(n)으로 재생성되므로, 데이터가 자주 바뀌는 경우의 만능 해법은 아닙니다.

~~~typescript
import { defineStore } from 'pinia'

type User = {
  id: string
  name: string
}

export const useUsersStore = defineStore('users', {
  state: () => ({
    users: [] as User[],
  }),

  getters: {
    userMap: (state) => new Map(state.users.map((user) => [user.id, user])),
  },
})
~~~

~~~typescript
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'

const usersStore = useUsersStore()
const { userMap } = storeToRefs(usersStore)
const selectedId = ref('user-42')

const selectedUser = computed(() => userMap.value.get(selectedId.value))
~~~

<code>storeToRefs()</code>는 store에서 state·getter를 구조 분해해도 반응성을 유지하게 합니다. action은 store instance에서 직접 호출하거나 별도로 구조 분해해도 됩니다.

### 2) 자주 바뀌는 ID 조회는 state를 정규화하기

개별 사용자 조회·삽입·수정이 모두 빈번하다면, 배열에서 파생 Map을 매번 재생성하기보다 ID를 key로 하는 state를 유지합니다. 반환 함수 getter에는 인자별 캐시가 없더라도 lookup 자체가 O(1)이므로 반복 <code>find()</code>보다 예측 가능해집니다.

~~~typescript
import { defineStore } from 'pinia'

type User = {
  id: string
  name: string
}

export const useUsersStore = defineStore('users', {
  state: () => ({
    byId: {} as Record<string, User>,
  }),

  getters: {
    userById: (state) => (id: string) => state.byId[id],
  },

  actions: {
    upsertUser(user: User) {
      this.byId[user.id] = user
    },
  },
})
~~~

| 요구 | 기본 선택 |
| :--- | :--- |
| 단순한 합계·필터·boolean 파생 값 | computed 또는 인자 없는 Pinia getter |
| 읽기는 많고 source 배열 갱신은 드묾 | 파생 Map getter |
| 개별 ID 읽기와 갱신이 모두 빈번함 | <code>Record&lt;id, value&gt;</code> 형태의 정규화 state |
| 서버 응답 재사용·만료·재검증 | fetch/data layer의 cache 정책 |

### 3) computed 결과의 identity도 비용이 된다

Vue 3.4 이상에서는 computed 결과가 이전 값과 같으면 effect를 다시 트리거하지 않습니다. 단 매번 새 객체·배열을 반환하면 참조가 달라 downstream update가 계속될 수 있습니다. 값이 단순한지, object identity를 안정화할 필요가 있는지, 계산 자체가 충분히 싼지를 측정한 뒤 개선합니다. 모든 computed에 수동 deep compare를 넣는 것은 대개 더 비쌉니다.

### 4) `computed`에는 값, `watch`에는 side effect를 둔다

| API | 알맞은 역할 | 주의점 |
| :--- | :--- | :--- |
| <code>computed</code> | template·다른 계산에서 재사용할 순수 파생 값 | source를 다시 변경하거나 네트워크 요청을 넣지 않기 |
| <code>watch</code> | 명시한 source 변화에 따른 요청, 저장, 외부 API 동기화 | 이전 요청·구독을 cleanup하지 않으면 stale 결과가 남을 수 있음 |
| <code>watchEffect</code> | 동기적으로 읽는 source가 명확한 작은 side effect | 첫 <code>await</code> 뒤에 읽은 값은 자동 추적하지 않으며, 의존성이 숨기기 쉬움 |

~~~vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const query = ref('')
const categoryId = ref('all')
const resultUrl = computed(
  () => `/api/products?q=${encodeURIComponent(query.value)}&category=${categoryId.value}`,
)

watch(resultUrl, (url, _previousUrl, onCleanup) => {
  const controller = new AbortController()
  onCleanup(() => controller.abort())

  // 결과 반영은 service state에 맞게 구현한다.
  void fetch(url, { signal: controller.signal }).catch((error: unknown) => {
    if (error instanceof DOMException && error.name === 'AbortError') return
    console.error('상품 조회 요청 실패', error)
  })
})
</script>
~~~

`watchEffect()`는 의존성을 자동 추적하는 대신 어떤 값이 effect를 다시 실행시키는지 코드만 보고 파악하기 어려울 수 있습니다. 값 자체는 `computed`, 명시적인 비동기·외부 동작은 `watch`를 우선 선택합니다. Nuxt에서는 browser-only effect를 `onMounted`에 두고, SSR와 client가 공유하는 data state는 [Chapter 9](./chapter-9-vue-nuxt-web-vitals.md)의 `useFetch`·`useAsyncData`·`useState` 흐름으로 관리합니다.

watch callback의 기본 flush 시점은 component DOM이 갱신되기 전입니다. 변경 뒤 DOM을 읽어야 할 때만 <code>{ flush: 'post' }</code>를 선택하고, 매 mutation을 즉시 실행하는 <code>flush: 'sync'</code>는 반복 갱신을 키울 수 있으므로 예외적인 경우에만 사용합니다.

---

## 3. 큰 목록의 업데이트 범위를 줄이기

대규모 목록은 반응성보다 DOM node 수와 component instance 수에서 먼저 병목이 생기는 경우가 많습니다. 최적화는 다음 순서로 적용합니다.

1. 각 child가 받는 props를 안정화합니다.
2. 화면에 보이는 항목만 렌더링하는 virtualization을 검토합니다.
3. 병목이 확인된 아주 큰 subtree에만 <code>v-once</code> 또는 <code>v-memo</code>를 적용합니다.

### 1) parent에서 상태를 계산해 stable props로 넘기기

모든 child에 <code>activeId</code>를 전달하면 선택 값 하나가 바뀔 때 목록 전체가 새 prop을 받을 수 있습니다. parent가 각 항목의 boolean을 계산해 넘기면, 실제로 선택 상태가 바뀐 항목만 update될 가능성이 커집니다.

~~~vue
<!-- ❌ activeId가 바뀔 때 모든 ListItem의 prop이 바뀐다. -->
<ListItem
  v-for="item in items"
  :key="item.id"
  :item-id="item.id"
  :active-id="activeId"
/>

<!-- ⭕ 대부분의 item에서 active 값은 그대로 유지된다. -->
<ListItem
  v-for="item in items"
  :key="item.id"
  :item-id="item.id"
  :active="item.id === activeId"
/>
~~~

목록이 수천 개라면 어떤 프레임워크도 모든 DOM node를 싸게 유지할 수 없습니다. 이 단계에서는 pagination, windowing, virtualization으로 실제 DOM 수를 줄이는 편이 <code>v-memo</code>보다 먼저입니다.

### 2) <code>v-once</code>와 <code>v-memo</code>를 미세 최적화로 사용하기

정적 마크업은 Vue compiler가 이미 hoist하므로 <code>v-once</code>가 필요하지 않습니다. <code>v-once</code>는 최초 runtime 값만 표시하고 이후 절대 바뀌지 않아야 하는 subtree를 동결할 때 사용합니다.

~~~vue
<!-- 최초 사용자 안내 문구만 표시하고 이후 변경을 반영하지 않는다. -->
<section v-once>
  <h2>{{ initialGuide.title }}</h2>
  <p>{{ initialGuide.description }}</p>
</section>
~~~

<code>v-memo</code>는 성능이 확인된 큰 <code>v-for</code> 목록에서만 사용합니다. dependency array에는 해당 subtree를 화면에 그리는 **모든 변경 가능 값**을 넣어야 합니다. 아래 예시는 item의 name·status가 바뀔 때마다 version도 증가한다는 전제가 있습니다.

~~~vue
<div
  v-for="item in items"
  :key="item.id"
  v-memo="[item.id === activeId, item.version]"
>
  <p>{{ item.name }} - {{ item.status }}</p>
  <span v-if="item.id === activeId">선택됨</span>
</div>
~~~

<code>:key</code>가 있으므로 item ID 자체를 memo dependency에 중복할 필요는 없습니다. <code>v-memo="[]"</code>는 사실상 <code>v-once</code>와 같고, dependency를 하나라도 빠뜨리면 오래된 UI를 만들 수 있습니다.

---

## 4. Vue와 Nuxt에서 최적화 범위를 지키기

Chapter 6의 도구는 component update 범위를 줄이는 데 초점을 둡니다. 반면 Nuxt 4에서는 SSR HTML, payload, Hydration이 초기 로드와 첫 상호작용에 추가 비용을 만듭니다. 다음 구분을 지키면 같은 설명을 반복하지 않고 원인을 추적하기 쉽습니다.

| 문제 | 이 장에서 판단할 것 | 이어서 볼 장 |
| :--- | :--- | :--- |
| 큰 nested data를 읽을 때 느림 | shallow API, immutable update, raw instance 여부 | [Chapter 9](./chapter-9-vue-nuxt-web-vitals.md) |
| store lookup·파생 계산이 반복됨 | getter, Map, normalized state 중 데이터 구조 선택 | [Chapter 9](./chapter-9-vue-nuxt-web-vitals.md) |
| 첫 화면이 늦거나 Hydration이 무거움 | 초기 chunk와 reactive update 범위 | [Chapter 8](./chapter-8-core-web-vitals.md), [Chapter 9](./chapter-9-vue-nuxt-web-vitals.md) |
| LCP·INP·CLS가 나쁨 | Vue 코드만 추측하지 않고 Trace와 Field data로 분해 | [Chapter 7](./chapter-7-web-vitals-measurement.md), [Chapter 8](./chapter-8-core-web-vitals.md) |

### 📋 Vue·상태 관리 체크리스트

* [ ] 큰 data가 실제로 깊은 property access와 렌더링 비용을 만드는지 측정했는가?
* [ ] <code>shallowRef</code> 내부 변경 대신 root replacement를 기본으로 했는가?
* [ ] 외부 class instance를 raw/proxy graph에 섞지 않았는가?
* [ ] getter가 인자를 받는다는 이유만으로 자동 캐시를 기대하지 않았는가?
* [ ] Map 재생성 비용과 normalized state의 갱신 비용 중 실제 사용 패턴에 맞는 것을 선택했는가?
* [ ] <code>storeToRefs</code>로 구조 분해한 state·getter의 반응성을 보존했는가?
* [ ] stable props와 virtualization을 먼저 적용한 뒤 <code>v-memo</code>를 검토했는가?
* [ ] <code>v-memo</code> dependency에 모든 변경 가능 렌더 값을 포함했는가?

### 📚 공식 참고 자료

* [Vue: Performance Best Practices](https://vuejs.org/guide/best-practices/performance)
* [Vue: Reactivity API Advanced](https://vuejs.org/api/reactivity-advanced.html)
* [Vue: Built-in Directives, v-once and v-memo](https://vuejs.org/api/built-in-directives)
* [Pinia: Getters](https://pinia.vuejs.org/core-concepts/getters.html)
* [Nuxt 4: Rendering Modes](https://nuxt.com/docs/4.x/guide/concepts/rendering)
