# 다른 도구와 비교

[English](./COMPARISON.md) | **한국어**

Next.js를 쓰는 사람과 React Router를 쓰는 사람은 애초에 고를 수 있는 게 다릅니다. Next는 라우팅을 직접 소유하니까 후보가 전부 "그 위에 타입만 얹는 도구"입니다. React Router라면 지금 라우터에 타입을 얹든지, 라우터를 통째로 바꾸든지 둘 중 하나고요. 표 하나로 합쳐봐야 양쪽 다 안 맞아서 나눠 뒀습니다.

- [Next.js를 쓴다면](#nextjs를-쓴다면)
- [React Router를 쓴다면](#react-router를-쓴다면)
- [TanStack Router는 왜 안 쓰나](#tanstack-router는-왜-안-쓰나)

기능 설명은 웬만해선 안 바뀝니다. 버전이나 릴리스 날짜, 다운로드 수는 다릅니다. 전부 2026-09-03에 확인했고, 나오는 자리마다 날짜를 적어 뒀습니다.

## typed-router에만 있는 것

조사해 보니 두 가지였습니다.

### 선언한 트리에서 라우터 설정이 나온다

지금 쓰는 라우터에 타입을 얹어주는 도구는 여럿 있습니다. 그중에 라우터 설정까지 만들어주는 건 typed-router뿐이었습니다. `toRouteObjects()`가 트리를 `createBrowserRouter`에 넣을 배열로 바꿔주기 때문에, 트리에 없는 라우트가 React Router에 존재할 방법이 없습니다.

나머지 도구들은 타입이 붙은 경로 문자열까지만 주고 `<Route>`는 직접 쓰게 합니다. `react-router-typesafe-routes`의 README에 나오는 방식이 이렇습니다.

```tsx
<Route path={root.user.$path()} element={<User />}>
```

경로 문자열은 안전합니다. 그런데 이 `<Route>`를 하나 빼먹거나, 트리에 없는 걸 하나 더 써넣어도 아무도 안 잡아줍니다.

### 메타데이터 타입이 라우트마다 따로 붙는다

노드마다 `_metadata`가 자기 모양을 유지합니다. 꺼내 쓸 때도, 트리를 순회할 때도 그대로입니다.

```ts
routes.getMetadata('/products').icon   // string. 이 노드에서 추론됨
routes.getMetadata('/cart').icon       // 컴파일 에러. /cart엔 icon이 없음

for (const route of routes.collected) {
  route.metadata.title                 // 여기서도 타입이 살아 있음
}
```

두 번째가 생각보다 중요합니다. 메타데이터를 붙이는 이유가 보통 메뉴나 빵부스러기, 사이트맵을 만들기 위해서인데 셋 다 라우트 목록을 순회해서 만들거든요. 여기서 타입이 풀려버리면 붙인 의미가 절반은 사라집니다.

다른 도구에서 비슷한 걸 찾으면 전부 전역입니다. TanStack Router의 `staticData`는 `StaticDataRouteOption` 인터페이스 하나를 모든 라우트가 공유합니다. 라우트마다 다른 필드를 넣고 싶으면 앱 전체에서 옵셔널로 선언하는 수밖에 없습니다.

## typed-router가 안 하는 것

데이터는 안 건드립니다. 로더도 캐시도 없고, 재검증이나 Suspense 연동도, 코드 스플리팅도, 로딩·에러 UI도 없습니다. `prefetch`가 있긴 한데 Next에서는 호스트 라우터로 넘기기만 하고 React Router 라이브러리 모드에서는 아무 일도 안 합니다.

Next에서는 트리를 손으로 선언하는데 실제로 서빙되는 건 `app/`입니다. 둘이 어긋날 수 있다는 뜻입니다. `assertRoutesMatchAppDir()`이 양쪽을 대조해 주긴 하지만 CI에서 직접 돌려야 하는 검사입니다. 타입 시스템이 알아서 막아주지는 않습니다.

React Router **framework 모드**(`@react-router/dev`)에서는 `toRouteObjects()`를 못 씁니다. 이쪽은 런타임에 해석되는 `element`를 내보내는데 framework 모드는 빌드 타임에 해석할 모듈 경로(`file`)를 원하거든요. 트리에서 설정을 만드는 것 자체는 되고 열다섯 줄 정도면 끝납니다. [루트 README에 설명해 뒀고](./README.ko.md#react-router-7-framework-mode) `examples/react-router-framework-example`이 실제로 돌아갑니다.

그리고 작습니다. 주당 288 다운로드입니다. 많이 쓰이는 대안들이 3만~4만 정도니까 자릿수가 다릅니다(2026-09-03). 프로덕션 트래픽을 얼마나 맞아봤느냐의 차이라고 보시면 됩니다.

## Next.js를 쓴다면

라우터는 Next 것이니 전부 그 위에 타입을 얹는 도구입니다.

| | 라우트 선언 | 쿼리 파라미터 | 경로 파라미터 | 라우트별 메타데이터 | 트리 ↔ `app/` 대조 |
| --- | --- | --- | --- | --- | --- |
| Next `typedRoutes` | 파일시스템에서 생성 | **타입 없음** | `string`, 검증 안 함 | 없음 | 해당 없음 |
| `nextjs-routes` | 파일시스템에서 생성 | 타입 없음 | 타입만, 검증 안 함 | 없음 | 해당 없음 |
| `pathpida` | 파일시스템에서 생성(CLI) | URL 만들 때만 | 타입만, 검증 안 함 | 없음 | 해당 없음 |
| `next-typesafe-url` | 경로는 생성, 스키마는 손으로 | Zod로 검증 | Zod로 검증 | 없음 | 대체로 막힘 |
| `next-safe-navigation` | 손으로 선언(평면) | Standard Schema로 검증 | 검증함 | 없음 | 안 함 |
| **typed-router** | 손으로 선언(**중첩 트리**) | Standard Schema로 검증 | **세그먼트별 스키마로 검증** | **있음(노드별)** | **양방향으로 함** |

**Next의 `typedRoutes`는 켜야 켜지고, pathname까지만 봅니다.** `next.config`에 `typedRoutes: true`를 넣어야 동작합니다. 문서에도 opt-in이라고 적혀 있습니다. 켜고 나면 뭘 만들어주는지는 빌드된 앱의 `.next/types/routes.d.ts`를 열어보면 나옵니다.

```ts
"/products/[id]": { "id": string; }
searchParams: Promise<Record<string, string | string[] | undefined>>
```

쿼리 파라미터는 그냥 문자열 맵입니다. `href` 쪽도 Next의 typegen 소스를 보면 쿼리 부분이 `` `?${string}` ``이라 뭘 넣든 통과합니다. 동적 세그먼트는 `string`으로만 잡히고 값 검증은 안 합니다. 반대로 말하면 "이 pathname이 진짜 있냐"만 확인하고 싶은 경우엔 `typedRoutes`로 충분하고, 뭘 더 깔 필요도 없습니다.

**쿼리 검증과 드리프트 검사를 같이 하는 도구는 드뭅니다.** 둘 다 하는 게 `next-typesafe-url`인데 6.1.0(2025-10-24) 이후로 릴리스가 없습니다. 배포된 `peerDependencies`가 `next: ^13.4.12 || ^14.0.0 || ^15.0.0`이라 Next 16은 선언된 범위 밖입니다. `nextjs-routes`는 마지막 릴리스가 2024-12-31이고, `nextRoutes()` 래퍼가 생성기를 `nextConfig.webpack`에 물려서 설치합니다. Turbopack에서는 Next이 이 콜백을 안 부릅니다. 직접 돌릴 수 있는 CLI는 따로 있습니다. `next-safe-navigation`은 2025-06-24가 마지막입니다. `pathpida`가 넷 중 제일 최근(0.26.1, 2026-03-25)인데 URL 만드는 쪽에만 타입을 붙입니다.

같은 잣대를 우리한테도 대면 이렇습니다. typed-router의 Next 패키지는 `next: ^13 || ^14 || ^15 || ^16`을 선언하지만 예제와 CI는 Next 15로 돕니다. peer 범위를 적어둔 건 주장이지 검증이 아닙니다. 남한테 그렇게 따졌으면 우리도 마찬가지입니다.

## React Router를 쓴다면

여기선 선택지가 갈립니다. 지금 라우터에 타입을 얹느냐, 다른 라우터로 가느냐.

| | 대상 라우터 | 라우터 설정 생성 | 쿼리 파라미터 | 라우트별 메타데이터 |
| --- | --- | --- | --- | --- |
| `react-router-typesafe-routes` | React Router | 안 함(`<Route>`는 직접) | Standard Schema / Zod / Yup, 해시와 state까지 | 없음 |
| `typesafe-routes` | 라우터 무관 | 안 함 | 자체 파서 | 없음 |
| `@zoontek/chicane` | 자체 라우터 | 해당 없음 | 문자열 | 없음 |
| `type-route` | 자체 라우터 | 해당 없음 | 자체 타입 | 없음 |
| **typed-router** | React Router 6/7 | **함(`toRouteObjects()`)** | Standard Schema로 검증 | **있음(노드별)** |

`react-router-typesafe-routes`는 타입 층 중에서 제일 잘 만들어져 있습니다. typed-router가 손 안 댄 데까지 갑니다. 해시랑 `location.state`에도 스키마가 붙고, 중첩 `<Routes>`용 상대 경로 처리도 있습니다. 다만 라우터 설정은 건드리지 않습니다. 그래서 타입 붙인 트리와 React Router가 실제로 서빙하는 라우트, 이렇게 두 벌을 손으로 맞춰가야 합니다.

`@zoontek/chicane`이나 `type-route`는 React Router 자리에 자기네 소형 라우터를 넣습니다. 교환 조건이 완전히 다릅니다. 타입이 일관되게 붙은 라우터를 얻는 대신 React Router 생태계를 내려놓게 됩니다.

2026-09-03 기준으로 정리하면 이렇습니다.

| | 주당 다운로드 | 마지막 릴리스 |
| --- | --- | --- |
| `react-router-typesafe-routes` | 3.14만 | 2.2.1 (2025-07-21) |
| `typesafe-routes` | 7.0천 | 12.3.0 (2025-08-12, 커밋은 2026-08까지) |
| `type-route` | 2.0천 | 1.1.0 (2023-12-09) |
| `@zoontek/chicane` | 422 | 3.0.0 (2026-04-20) |
| typed-router | 288 | 2.1.0 (2026-09-02) |

## TanStack Router는 왜 안 쓰나

같은 종류의 물건이 아닙니다. TanStack Router는 라우터입니다. 로더, 캐시, 프리로드, 코드 스플리팅, pending·에러 바운더리를 다 갖고 있고 쿼리 파라미터 상태도 라우터가 직접 관리합니다. typed-router는 이미 있는 라우터 위에 타입과 IA를 얹는 층이고 저 목록에 해당하는 게 하나도 없습니다.

채택 규모도 비교가 안 됩니다. `@tanstack/react-router-devtools`가 주당 330만입니다(TanStack Start가 라우터를 고정 의존성으로 끌고 들어오는 효과가 안 섞인 지표라 이걸 씁니다). typed-router는 288입니다.

그래서 대체재가 되느냐는 세 가지로 갈립니다.

**Next.js에서는 아예 선택지가 아닙니다.** 라우팅을 Next이 갖고 있고, TanStack은 Next용 통합을 안 만듭니다. `@tanstack/router-plugin`이 내보내는 진입점은 Vite, Rspack, esbuild, webpack입니다. Next이나 Turbopack용은 없습니다. `@tanstack/react-start`는 peer로 `vite >=7`이나 `@rsbuild/core ^2`를 요구합니다. TanStack에 있는 유일한 Next.js 문서는 [Next에서 빠져나오는 가이드](https://tanstack.com/start/latest/docs/framework/react/migrate-from-next-js)인데, 첫 단계가 Next.js를 지우라는 겁니다. (2026-09-03에 `@tanstack/router-plugin` 1.168.35, `@tanstack/react-start` 1.168.49로 확인했습니다.)

**React Router에서는 야심이 아니라 변경 범위가 기준입니다.** TanStack Router를 도입하면 라우터를 갈아치우고 그쪽 런타임과 개념까지 같이 받습니다. typed-router는 React Router를 그대로 두고 타입과 선언된 IA만 얹습니다. 렌더링을 안 건드리니까 나중에 걷어내기도 쉽습니다.

**메타데이터 타입이 붙는 방식이 다릅니다.** TanStack의 `staticData`는 앱 전체가 공유하는 인터페이스 하나입니다. typed-router는 라우트마다 그 라우트의 선언에서 추론합니다. 여기엔 아이콘, 저기엔 권한, 또 다른 데는 빵부스러기 라벨을 붙이고 있다면 이 차이가 바로 느껴집니다.

## 어떻게 확인했나

typed-router에 대한 위 내용은 전부 이 저장소 코드로 다시 돌려봤습니다. 예전 초안에서 그대로 가져온 건 없습니다.

- 객체와 배열 쿼리 파라미터가 `buildHref` → `parseSearchParams`로 왕복하는지
- `parseParams`가 `/products/[id]`를 숫자로 바꾸고 `abc`에는 `PathParamsParseError`를 던지는지
- `routes.collected[n].metadata`가 `tsc` 아래에서 타입을 유지하는지
- `findRouteDrift`가 실제 `app/` 디렉터리를 놓고 "선언했는데 없는 라우트"와 "선언 안 했는데 서빙되는 페이지"를 둘 다 잡는지

다른 라이브러리 얘기는 홈페이지가 아니라 배포된 물건에서 가져왔습니다. `peerDependencies`와 릴리스 날짜는 npm 레지스트리, 커밋 날짜는 GitHub API, `exports` 맵은 배포 패키지에서 직접 읽었습니다. `nextjs-routes`와 Next의 typegen은 배포된 소스를 봤습니다. 직접 확인하고 싶으시면 이 두 줄이면 됩니다.

```bash
npm view <패키지> peerDependencies
gh api repos/<owner>/<repo>/commits?per_page=1
```

제일 빨리 낡는 건 "이 라이브러리 멈췄다", "이 버전은 지원 안 한다" 쪽입니다. 2026-09-03에서 한참 지나서 보고 계신다면 그 부분은 믿기 전에 한 번 확인해 보세요.
