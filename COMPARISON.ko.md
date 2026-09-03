# typed-router는 다른 도구와 무엇이 다른가

[English](./COMPARISON.md) | **한국어**

여기에 표 하나는 없습니다. 비교 자체가 하나가 아니기 때문입니다. Next.js를 쓰고 있다면 라우팅은 Next이 소유하고, 선택할 수 있는 도구는 전부 그 위에 타입을 얹는 층입니다. React Router를 쓰고 있다면 지금 쓰는 라우터에 타입을 얹거나, 라우터 자체를 바꾸거나 둘 중 하나입니다. 서로 다른 결정이고 후보도 다르므로 절을 나눴습니다 — [Next.js](#nextjs를-쓰고-있다면), [React Router](#react-router를-쓰고-있다면), 그리고 어느 쪽에도 속하지 않는 [TanStack Router](#tanstack-router는-왜-안-쓰나).

아래의 기능 서술은 오래 가도 맞도록 썼습니다. 버전, 릴리스 날짜, 다운로드 수치는 그렇지 않습니다 — **2026-09-03** 기준이고, 나오는 자리마다 날짜를 적었습니다.

## typed-router만 하는 것

여기서 조사한 라이브러리들 중에서는 두 가지입니다.

**선언이 라우터 설정을 만들어냅니다.** 이미 쓰고 있는 라우터에 타입을 얹는 도구 중에서, 그 라우터의 설정까지 함께 내보내는 건 typed-router뿐입니다. `toRouteObjects()`가 트리를 `createBrowserRouter`가 받는 배열로 바꾸므로, 선언에 없는 라우트가 React Router에 존재할 수 없습니다. 다른 React Router 도구들은 타입이 붙은 경로 문자열까지만 주고 `<Route>`는 여러분에게 맡깁니다 — `react-router-typesafe-routes`의 README가 `<Route path={root.user.$path()} element={<User />}>`로 직접 보여주는 방식입니다. 손으로 쓴 `<Route>`가 타입 트리에 짝이 없어도 아무것도 막지 않습니다.

**메타데이터의 타입이 앱 단위가 아니라 라우트 단위입니다.** 각 노드의 `_metadata`는 자기 모양을 유지하고, 그 모양은 직접 접근할 때도 순회할 때도 살아남습니다.

```ts
routes.getMetadata('/products').icon   // string — 이 노드에서 추론됨
routes.getMetadata('/cart').icon       // 컴파일 에러 — /cart는 icon을 선언하지 않음

for (const route of routes.collected) {
  route.metadata.title                 // 여전히 타입이 붙음, Record<string, unknown>이 아님
}
```

뒤쪽 절반이 보기보다 중요합니다. 메뉴, 빵부스러기, 사이트맵은 애초에 메타데이터를 붙이는 대표적인 이유이고, 셋 다 라우트 목록을 순회해서 만듭니다. 다른 도구에서 가장 가까운 것들은 전역입니다 — TanStack Router의 `staticData`는 모든 라우트가 공유하는 `StaticDataRouteOption` 인터페이스 하나로 타입이 정해지므로, 라우트마다 다른 필드는 앱 전체에서 옵셔널로 선언할 수밖에 없습니다.

## typed-router가 하지 않는 것

타입과 정보 구조를 담당하는 층입니다. 데이터 로딩은 전혀 하지 않습니다 — 로더도, 캐시도, 재검증도, Suspense 연동도, 코드 스플리팅도, 로딩·에러 UI도 없습니다. `prefetch`는 Next.js에서 호스트 라우터의 prefetch로 넘길 뿐이고 React Router 라이브러리 모드에서는 아무 동작도 하지 않습니다. 자체 프리페치는 없습니다.

Next.js에서는 트리를 손으로 선언하는 반면 실제로 서빙되는 건 `app/`이므로, 둘이 어긋날 수 있습니다. `assertRoutesMatchAppDir()`이 양방향으로 대조해주지만 이건 CI에서 직접 돌리는 검사이지, 타입 시스템이 스스로 강제하는 것이 아닙니다.

React Router의 **framework 모드**(`@react-router/dev`)에서는 `toRouteObjects()`를 쓸 수 없습니다 — 런타임에 해석되는 `element` / `Component`를 내보내는데, framework 모드는 빌드 타임에 해석하는 모듈 경로 `file`을 원하기 때문입니다. 그래도 트리가 설정을 만들어내는 건 그대로이고 열다섯 줄 정도면 됩니다. [루트 README에 이 구분을 설명해뒀고](./README.ko.md#react-router-7-framework-mode), `examples/react-router-framework-example`이 실제로 돌아갑니다.

그리고 작습니다. 주당 288 다운로드로, 널리 쓰이는 대안들의 3.1만~3.9만에 비할 바가 아닙니다(2026-09-03). 이 코드가 실제 프로덕션 트래픽을 얼마나 맞아봤는지의 차이입니다.

## Next.js를 쓰고 있다면

라우터는 Next이 소유하므로, 여기 있는 것들은 전부 그 위에 타입을 얹습니다.

| | 라우트 선언 방식 | 쿼리 파라미터 | 경로 파라미터 | 라우트별 메타데이터 | 트리 ↔ `app/` 드리프트 |
| --- | --- | --- | --- | --- | --- |
| Next의 `typedRoutes` | 파일시스템에서 생성 | **타입 없음** | `string` 타입, 검증 없음 | — | 해당 없음 (파일시스템이 곧 트리) |
| `nextjs-routes` | 파일시스템에서 생성 | 타입 없는 bag | 타입만, 검증 없음 | — | 해당 없음 |
| `pathpida` | 파일시스템에서 생성 (CLI) | URL을 만들 때만 타입 | 타입만, 검증 없음 | — | 해당 없음 |
| `next-typesafe-url` | 경로는 생성, 스키마는 손으로 | Zod 검증 | Zod 검증 | — | 대부분 방지 |
| `next-safe-navigation` | 손으로 선언, 평면 | Standard Schema 검증 | 검증 O | — | 검사 없음 |
| **typed-router** | 손으로 선언, **중첩 트리** | Standard Schema 검증 | **세그먼트별 스키마, 검증 O** | **있음, 노드별** | **양방향 검사** |

**Next 자체의 `typedRoutes`는 opt-in이고, pathname에서 멈춥니다.** `next.config`에 `typedRoutes: true`를 넣어야 하고, 문서도 이걸 "opt-in하는 기능"이라고 명시합니다. 켠 뒤 생성되는 것은 직접 확인할 수 있습니다 — 빌드된 앱의 `.next/types/routes.d.ts`에 이렇게 들어 있습니다.

```ts
"/products/[id]": { "id": string; }
searchParams: Promise<Record<string, string | string[] | undefined>>
```

그리고 Next의 typegen 소스에서 `href` 타입의 쿼리 부분은 `` `?${string}` ``으로 정의돼 있어, 어떤 쿼리 문자열이든 통과합니다. 동적 세그먼트는 `string`으로 타입이 붙고 검증되지 않습니다. "이 pathname이 존재한다"만 필요하다면 `typedRoutes`로 충분하고, 추가 비용도 없습니다.

**쿼리 파라미터 검증과 드리프트 검사를 함께 갖춘 경우는 드뭅니다.** 둘 다 하는 건 `next-typesafe-url`인데, 6.1.0(2025-10-24) 이후 릴리스가 없고 배포된 `peerDependencies`가 `next: ^13.4.12 || ^14.0.0 || ^15.0.0`이라 Next 16은 선언된 범위 밖입니다. `nextjs-routes`는 2024-12-31이 마지막 릴리스이고, `nextRoutes()` 설정 래퍼가 생성기를 `nextConfig.webpack`을 통해 설치하는데 Turbopack에서는 Next이 이 콜백을 호출하지 않습니다 — 직접 실행할 수 있는 CLI도 함께 제공합니다. `next-safe-navigation`은 2025-06-24가 마지막 릴리스입니다. `pathpida`는 넷 중 릴리스가 가장 최근이고(0.26.1, 2026-03-25), URL을 만드는 쪽에만 타입을 붙입니다.

같은 축에서 밝혀두면: typed-router의 Next 패키지는 `next: ^13 || ^14 || ^15 || ^16`을 선언하고, 예제 앱과 CI는 Next 15로 돕니다. 선언된 peer 범위는 주장이지 검증이 아닙니다 — 남들에게 그런 만큼 우리에게도 그렇습니다.

## React Router를 쓰고 있다면

여기서는 선택지가 실제로 갈립니다. 지금 라우터에 타입을 얹느냐, 다른 라우터로 가느냐입니다.

| | 대상 라우터 | 라우터 설정 생성 | 쿼리 파라미터 | 라우트별 메타데이터 |
| --- | --- | --- | --- | --- |
| `react-router-typesafe-routes` | React Router | 안 함 — `<Route>`는 직접 | Standard Schema / Zod / Yup, 해시와 state까지 | — |
| `typesafe-routes` | 라우터 무관 | 안 함 | 자체 파서 | — |
| `@zoontek/chicane` | 자체 라우터 | 해당 없음 | 문자열 | — |
| `type-route` | 자체 라우터 | 해당 없음 | 자체 타입 | — |
| **typed-router** | React Router 6/7 | **함 — `toRouteObjects()`** | Standard Schema 검증 | **있음, 노드별** |

`react-router-typesafe-routes`는 타입 층 중에서 가장 완성도가 높고, typed-router가 다루지 않는 영역까지 갑니다 — 해시와 `location.state`에도 스키마가 붙고, 중첩 `<Routes>`를 위한 상대 경로 처리가 있습니다. 하지 않는 건 라우터 설정을 소유하는 일입니다. 그래서 타입을 붙인 트리와 React Router가 실제로 서빙하는 라우트가 손으로 맞춰야 하는 두 개의 산출물로 남습니다.

`@zoontek/chicane`과 `type-route`는 React Router를 자체 소형 라우터로 대체합니다. 완전히 다른 교환입니다 — 일관되게 타입이 붙은 라우터를 얻고 React Router의 생태계를 내려놓습니다.

2026-09-03 기준 상황: `react-router-typesafe-routes` 주당 3.14만, 마지막 릴리스 2.2.1(2025-07-21) · `typesafe-routes` 7.0천, 12.3.0(2025-08-12, 커밋은 2026-08까지) · `@zoontek/chicane` 422, 3.0.0(2026-04-20) · `type-route` 2.0천, 1.1.0(2023-12-09) · typed-router 288, 2.1.0(2026-09-02).

## TanStack Router는 왜 안 쓰나

짧게 답하면, 같은 종류의 물건이 아닙니다. TanStack Router는 라우터입니다 — 로더, 캐시, 프리로드, 코드 스플리팅, pending·에러 바운더리, 그리고 라우터의 일급 관심사로서의 쿼리 파라미터 상태까지. typed-router는 이미 있는 라우터 위의 타입·IA 층이고, 그중 아무것도 하지 않습니다. 채택 규모도 큰 차이로 앞섭니다 — TanStack Start가 라우터를 고정 의존성으로 물고 들어오는 효과가 섞이지 않은 채택 지표에 가장 가까운 `@tanstack/react-router-devtools`가 2026-09-03 기준 주당 330만이고, typed-router는 288입니다.

대체재가 될 수 있는지는 다음 세 가지가 가릅니다.

**Next.js에서는 선택지가 아닙니다.** 라우팅을 Next이 소유하고, TanStack은 Next용 통합을 제공하지 않습니다. `@tanstack/router-plugin`은 Vite, Rspack, esbuild, webpack 진입점을 내보내고 Next이나 Turbopack용은 없습니다. `@tanstack/react-start`는 peer로 `vite >=7` 또는 `@rsbuild/core ^2`를 요구합니다. TanStack의 유일한 Next.js 문서는 [Next에서 이전해 나가는 가이드](https://tanstack.com/start/latest/docs/framework/react/migrate-from-next-js)이고, 첫 단계가 Next.js를 지우라는 것입니다. (2026-09-03에 `@tanstack/router-plugin` 1.168.35, `@tanstack/react-start` 1.168.49로 확인.)

**React Router에서는 축이 야심이 아니라 변경 범위입니다.** TanStack Router를 도입하는 건 라우터를 교체하고 그 런타임과 개념을 함께 받는 일이고, typed-router를 도입하는 건 React Router를 그대로 두고 타입과 선언된 정보 구조만 더하는 일입니다. 후자는 렌더링 방식을 건드리지 않고 다시 걷어낼 수 있습니다.

**메타데이터의 타입이 붙는 방식이 다릅니다.** TanStack의 `staticData`는 앱 전체가 공유하는 인터페이스 하나입니다. typed-router는 각 라우트의 메타데이터를 그 라우트 자신의 선언에서 추론합니다. 라우트마다 다른 필드를 붙이고 있다면 — 여기엔 아이콘, 저기엔 권한, 또 다른 곳엔 빵부스러기 라벨 — 체감되는 차이가 이것입니다.

## 어떻게 확인했나

위의 typed-router에 관한 주장은 전부 이 저장소의 코드로 다시 검증했습니다. 이전 초안에서 옮겨오지 않았습니다 — 객체와 배열 쿼리 파라미터가 `buildHref` → `parseSearchParams`로 왕복하는 것, `parseParams`가 `/products/[id]`를 숫자로 변환하고 `abc`에는 `PathParamsParseError`를 던지는 것, `routes.collected[n].metadata`가 `tsc` 아래에서 타입을 유지하는 것, `findRouteDrift`가 실제 `app/` 디렉터리를 대상으로 "선언됐지만 없는 라우트"와 "선언되지 않았지만 서빙되는 페이지"를 모두 보고하는 것.

경쟁 라이브러리에 대한 사실은 마케팅 페이지가 아니라 배포된 산출물에서 가져왔습니다. `peerDependencies`와 릴리스 날짜는 npm 레지스트리, 커밋 날짜는 GitHub API, `exports` 맵은 배포된 패키지에서 직접 읽었고, `nextjs-routes`와 Next의 typegen은 배포된 소스를 봤습니다. 다시 확인하고 싶다면 `npm view <pkg> peerDependencies`와 `gh api repos/<owner>/<repo>/commits?per_page=1`로 그대로 하실 수 있습니다.

가장 빨리 낡는 건 활동 정지 여부와 버전 지원 범위에 대한 판단입니다. 2026-09-03에서 한참 지난 뒤에 읽고 계신다면, 그 부분은 의존하기 전에 다시 확인하시기 바랍니다.
