# 📌 Chapter 6: Vue.js & 상태 관리 최적화 (Vue Reactivity & Cache)

Vue 3의 핵심 기능인 반응형 시스템(Reactivity System)의 원리를 이해하고, 불필요한 재귀적 관찰(Deep Observation) 오버헤드를 제어하며 전역 저장소인 Pinia 연산 캐싱을 고도로 튜닝하는 기법을 다룹니다.

---

## 1. 반응형 시스템 최적화 (`shallowRef` & `shallowReactive`)

Vue 3의 `ref`와 `reactive`는 내부적으로 JavaScript `Proxy` 객체를 씌워 상태가 바뀔 때 화면이 유기적으로 자동 갱신되도록 대행합니다. 

그러나 오직 읽기 가공용으로만 쓰이는 10,000줄 이상의 대규모 JSON 데이터, 대량의 외부 차트용 데이터 배열, 혹은 Leaflet/OpenLayers 등의 복잡한 타사 맵 라이브러리 인스턴스를 일반 `ref`에 그대로 대입하면, Vue는 내부의 모든 중첩 속성마다 재귀적으로 Proxy 래퍼를 구성하는 깊은 관찰(Deep Observation)을 동기식으로 진행하게 되어 초기 화면 렌더링 시점에 수백 ms의 긴 정체(Lag) 현상이 유발됩니다.

### 1) shallowRef / shallowReactive의 역할
속성 포인터 감시 대상을 가장 바깥쪽의 최상위 1단계(표면)로만 격리하는 경량 헬퍼입니다.

* **`shallowRef`**: `.value`가 아예 새로운 객체 주소로 교체될 때만 반응하여 화면 리렌더링을 지시하고, 객체 내부 속성의 값 변경(예: `chartData.value[0].name = 'NewName'`)은 전혀 추적하지 않아 탐색 연산을 무시합니다.
* **`shallowReactive`**: 객체의 첫 번째 레벨 속성 변경에만 반응하고, 그 하위의 모든 계층 데이터는 프록시 래퍼를 씌우지 않는 순수 원본 상태로 보존합니다.

### 2) 🛠️ 코드 비교를 통한 오버헤드 단축

```typescript
// ❌ 나쁜 예 (Deep Reactivity Overkill)
import { ref } from 'vue';
// 10,000개의 행 데이터 전체에 대해 중첩 감시 프록시가 동기식 생성되어 로드 타임 지연
const chartData = ref(largeArrayFromApi);
```

```typescript
// ⭕ 좋은 예 (Shallow Optimization)
import { shallowRef } from 'vue';
// 최상위 겉 껍데기 포인터만 주시하여, 메모리 낭비 없이 대형 데이터 즉시 대입
const chartData = shallowRef(largeArrayFromApi);
```

---

## 2. Pinia Getter 및 Computed 캐싱 최적화

Pinia의 `getters`는 Vue 컴포넌트 단의 **Computed 속성**과 완전히 동일하게 작동합니다. 의존하고 있는 `state` 값이 물리적으로 변경되기 전까지는 연산 결과 값을 자체 메모리에 캐싱(Caching)해 둡니다. 여러 컴포넌트가 동일 게터를 동시 참조해도 실제 함수 내부 루프 연산은 1회만 계산되어 오버헤드를 아낍니다.

### 1) 캐싱을 붕괴시키는 안티패턴 (인자 전달)
상태 값을 ID 등에 매칭하기 위해 Getter 내부에서 또 다른 함수를 반환하는 구조로 정의하는 경우가 많습니다.

```typescript
// ❌ 나쁜 예 (매 호출마다 필터 연산 수행 - 캐싱 상실)
getters: {
  getUserById: (state) => {
    // 매번 함수가 리턴되어 실행되므로, 캐싱 혜택 없이 state가 감시될 때마다 find 루프 작동
    return (id: number) => state.users.find(user => user.id === id);
  }
}
```

### 2) 캐싱 효율 극대화 개선 방안 (Map 자료 구조 활용)
인자를 받아 계산하는 루프를 즉각 매번 돌리지 않고, state 변경 시점에 단 1회만 맵 구조(`Map`)를 빌드하여 캐싱해 둔 후 컴포넌트에서 즉시 O(1) 탐색으로 찾아 쓰도록 최적화합니다.

```typescript
// ⭕ 좋은 예 (Map 구조를 통한 캐싱 보존)
getters: {
  // state.users가 변경될 때에만 단 1회 가공하여 Map으로 캐시 보전
  userMap: (state) => {
    return new Map(state.users.map(user => [user.id, user]));
  }
}

// 컴포넌트 사용 시점 호출 (메모리에 캐시된 Map에서 즉시 탐색)
const user = store.userMap.get(targetUserId);
```

이 설계를 통해 컴포넌트 리렌더링 시 유발되는 상태 조회용 무거운 순회(Loop) 연산을 완전히 차단할 수 있습니다.

---

## 3. Memoization 최적화 (`v-once`와 `v-memo`)

대규모 돔 트리 갱신 및 리스트 패치 연산 비용을 제어하기 위해 가상 DOM(Virtual DOM) 업데이트 흐름을 선택적으로 바이패스하는 최적화 지시자 기법입니다.

### 1) `v-once`: 정적 컴포넌트 업데이트 스킵
* 한 번 렌더링된 이후 상태가 절대로 업데이트되지 않고 박제되는 요소(예: 고정 공지사항 가이드, 약관 텍스트 블록)에는 `v-once` 디렉티브를 명시합니다. 
* Vue는 이 요소를 완전히 정적(Static) 돔으로 취급해 가상 DOM 비교(Diffing) 대상에서 영구 제외하므로 불필요한 패치 연산 CPU 비용을 대폭 아낄 수 있습니다.

```html
<!-- 최초 1회만 마운트되고 이후 상태 변경 시 완전히 업데이트 패치 무시 -->
<div v-once>
  <h1>{{ staticTitle }}</h1>
  <p>{{ staticContent }}</p>
</div>
```

### 2) `v-memo`: 조건부 Virtual DOM 갱신 (Vue 3.2+)
* 엄청나게 긴 리스트 렌더링이나 복잡한 그리드 컴포넌트에서, 무관한 다른 상태(예: 외부 검색바 인풋)가 타이핑될 때마다 리스트 내부의 모든 아이템들까지 전부 가상 DOM 비교 대상에 들어가는 것은 낭비가 큽니다.
* `v-memo` 디렉티브는 **"배열 내에 지정한 특정 조건 값이 바뀔 때만 나 자신과 내 자식의 렌더 트리를 재생성 및 diffing하라"**고 지시하는 최적화 유틸리티입니다.

```html
<!-- item.id와 item.isSelected가 변할 때만 가상 DOM 업데이트 가동 -->
<div 
  v-for="item in hugeList" 
  :key="item.id" 
  v-memo="[item.id === activeId, item.isSelected]"
>
  <p>{{ item.name }} - {{ item.status }}</p>
  <span v-if="item.isSelected">선택됨</span>
</div>
```

> [!WARNING]
> `v-memo`에 빈 배열 `v-memo="[]"`을 적으면 `v-once`와 완벽히 똑같이 작용합니다. 반응적 변경이 일어날 종속 변수를 누락하고 지정하면 화면에 갱신되지 않는 치명적인 동기화 버그가 생기므로 주의하십시오.

