# 다른 라이브러리와 비교

[English](./COMPARISON.md) | **한국어**

typed-router와 비슷한 문제를 다루는 라이브러리를 기능별로 비교합니다. 프레임워크마다 선택할 수 있는 라이브러리가 달라서 [Next.js](#nextjs)와 [React Router](#react-router)를 나눠서 정리했습니다. 라우터 자체인 [TanStack Router](#tanstack-router)는 따로 다룹니다.

typed-router는 이미 쓰고 있는 라우터에 타입과 라우트 정보를 더하는 라이브러리입니다. 데이터 로딩, 캐시, 코드 스플리팅, 로딩·에러 UI는 제공하지 않습니다.

> 정확하고 공정하게 작성하려고 했지만 빠지거나 달라진 내용이 있을 수 있습니다. 각 라이브러리의 공식 문서도 함께 확인하세요. 잘못된 내용은 [이슈](https://github.com/hyeonQyu/typed-router/issues)로 알려 주시면 고치겠습니다.
>
> 2026-10-24에 각 패키지의 최신 배포본을 기준으로 작성했습니다. 비교한 버전은 [비교 기준](#비교-기준)에 있습니다.

**범례:** ✅ 기본 제공 · 🟡 일부 지원 · 🛑 지원하지 않음 · — 해당 없음

## Next.js

|  | typed-router | Next 내장 `typedRoutes` | nextjs-routes | pathpida | next-typesafe-url | next-safe-navigation |
| --- | --- | --- | --- | --- | --- | --- |
| App Router | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pages Router | ✅ | 🟡<sup>1</sup> | ✅ | ✅ | ✅ | 🛑 |
| 라우트 정의 | 직접 선언 (중첩 트리) | 파일시스템에서 생성 | 파일시스템에서 생성 | 파일시스템에서 생성 | 경로는 생성, 스키마는 직접 작성 | 직접 선언 |
| pathname 타입 검사 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 경로 파라미터 타입 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 경로 파라미터 런타임 검증 | ✅ | 🛑 | 🛑 | 🛑 | ✅ | ✅ |
| 쿼리 파라미터 타입 | ✅ | 🛑<sup>2</sup> | 🛑 | 🟡<sup>3</sup> | ✅ | ✅ |
| 쿼리 파라미터 런타임 검증 | ✅<sup>4</sup> | 🛑 | 🛑 | 🛑 | ✅ | ✅ |
| 스키마 라이브러리 | Standard Schema | — | — | — | Zod | Standard Schema |
| 라우트별 메타데이터 | ✅ | 🛑 | 🛑 | 🛑 | 🛑 | 🛑 |
| 라우트 선언과 파일시스템 대조<sup>5</sup> | ✅<sup>6</sup> | — | — | — | 🟡<sup>7</sup> | 🛑 |
| `peerDependencies`의 Next 16 포함 | ✅<sup>8</sup> | — | ✅<sup>9</sup> | —<sup>10</sup> | 🛑 | ✅ |

1. `next/link`의 `href`는 두 라우터에서 모두 검사합니다. Pages Router의 `next/router` 메서드(`push`, `replace` 등)는 검사하지 않습니다. 기본값은 꺼져 있으며 `next.config`에 `typedRoutes: true`를 지정해야 동작합니다.
2. `href`의 쿼리 부분 타입이 `` `?${string}` ``이어서 어떤 쿼리 문자열도 허용합니다. 페이지의 `searchParams` 타입은 `Record<string, string | string[] | undefined>`입니다.
3. URL을 만들 때만 타입을 검사합니다. 쿼리를 읽는 쪽 타입은 제공하지 않습니다.
4. 스키마 대신 `searchParamKeys()`로 키 이름만 선언할 수도 있습니다. 이 경우 값을 검증하지 않고 문자열로 읽습니다.
5. 파일시스템에서 라우트를 생성하는 라이브러리는 선언과 파일시스템이 어긋날 수 없으므로 해당 없음으로 표시했습니다.
6. `@hyeonqyu/typed-router-next/check`의 `assertRoutesMatchAppDir()`, `assertRoutesMatchPagesDir()`로 양방향 대조합니다. 테스트나 CI에서 실행하는 검사이며, 타입 검사 단계에서는 잡히지 않습니다.
7. 경로는 파일시스템에서 생성하고, 쿼리·경로 파라미터 스키마는 별도 파일에 직접 작성합니다.
8. 저장소의 예제와 CI는 Next 15에서 실행합니다.
9. `next: *`를 선언합니다. Next 설정 래퍼 `nextRoutes()`는 webpack 설정 콜백으로 생성기를 등록하는데, Turbopack 빌드에서는 이 콜백이 호출되지 않습니다. CLI로 직접 생성할 수 있습니다.
10. `peerDependencies`를 선언하지 않습니다.

## React Router

|  | typed-router | react-router-typesafe-routes | typesafe-routes | @zoontek/chicane | type-route |
| --- | --- | --- | --- | --- | --- |
| 대상 라우터 | React Router 6, 7 | React Router 7 | 라우터 무관 | 자체 라우터 | 자체 라우터 |
| 중첩 라우트 선언 | ✅ | ✅ | ✅ | 🛑 | 🛑 |
| pathname 타입 검사 | ✅ | ✅ | ✅ | ✅ | ✅ |
| 라우터 설정 생성 | ✅<sup>1</sup> | 🛑<sup>2</sup> | 🛑 | — | — |
| 쿼리 파라미터 | Standard Schema | Standard Schema, Zod, Yup<sup>3</sup> | 자체 파서 | 문자열 | 자체 타입 정의 |
| 라우트별 메타데이터 | ✅ | 🛑 | 🛑<sup>4</sup> | 🛑 | 🛑 |

1. `toRouteObjects()`가 `createBrowserRouter`에 전달할 라우트 배열을 만듭니다. framework 모드(`@react-router/dev`)에서는 사용할 수 없으며, 라우트 트리로 `routes.ts` 설정을 만드는 방법은 [README](./README.ko.md#react-router-7-framework-mode)에 있습니다.
2. 타입이 있는 경로 문자열을 제공하며, `<Route>`는 직접 작성합니다.
3. 해시와 `location.state`에도 스키마를 지정할 수 있습니다. typed-router는 지원하지 않습니다.
4. 타입 정의에 `meta?: any` 필드가 있으나 라우트별 타입 추론은 없습니다.

## TanStack Router

TanStack Router는 라우터이고, typed-router는 기존 라우터 위에서 동작하는 라이브러리입니다. 범주가 달라서 위 표와 분리했습니다.

|  | typed-router | TanStack Router |
| --- | --- | --- |
| 역할 | 기존 라우터에 타입 추가 | 라우터 |
| Next.js에서 사용 | ✅ | 🛑<sup>1</sup> |
| React Router 유지 | ✅ | 🛑 (라우터를 교체) |
| pathname·파라미터 타입 검사 | ✅ | ✅ |
| 쿼리 파라미터 런타임 검증 | ✅ | ✅ |
| 데이터 로딩·캐시 | 🛑 | ✅ |
| 프리로드 | 🛑<sup>2</sup> | ✅ |
| 코드 스플리팅 | 🛑 | ✅ |
| 로딩·에러 UI | 🛑 | ✅ |
| 라우트별 메타데이터 타입 | ✅ | 🟡<sup>3</sup> |

1. TanStack은 Next.js 통합을 제공하지 않습니다. `@tanstack/router-plugin`의 진입점은 Vite, Rspack, esbuild, webpack용이고, `@tanstack/react-start`는 `vite` 또는 `@rsbuild/core`를 peer로 요구합니다. Next.js 관련 공식 문서는 [Next.js에서 TanStack Start로 옮기는 가이드](https://tanstack.com/start/latest/docs/framework/react/migrate-from-next-js)입니다.
2. `prefetch`는 Next.js에서 Next 라우터의 prefetch를 호출하며, React Router 라이브러리 모드에서는 동작하지 않습니다.
3. `staticData`의 타입은 모든 라우트가 공유하는 `StaticDataRouteOption` 인터페이스 하나로 정해집니다. 라우트마다 다른 필드는 이 인터페이스에 옵셔널로 선언해야 합니다.

## 비교 기준

2026-10-24 기준 npm 최신 배포본입니다. 각 항목은 배포된 패키지의 진입점, `peerDependencies`, 소스와 공식 문서를 기준으로 확인했습니다.

| 패키지 | 버전 |
| --- | --- |
| `@hyeonqyu/typed-router-*` | 2.4.1 |
| `next` | 16.4.3 |
| `nextjs-routes` | 2.2.5 |
| `pathpida` | 0.28.0 |
| `next-typesafe-url` | 6.1.0 |
| `next-safe-navigation` | 0.4.0 |
| `react-router-typesafe-routes` | 2.2.1 |
| `typesafe-routes` | 12.3.0 |
| `@zoontek/chicane` | 3.0.0 |
| `type-route` | 1.1.0 |
| `@tanstack/react-router` | 1.170.46 |
