# @hyeonqyu/typed-router-next

[English](./README.md) | **한국어**

Next.js App Router와 Pages Router를 위한 타입 안전 라우팅입니다. 1–7절은 App Router를 다루고, Pages Router는 같은 API를 별도 엔트리로 제공하며 [9절](#9-pages-router)에서 다룹니다. typed-router가 처음이라면 [프로젝트 개요](../../README.ko.md)에서 왜 만들어졌는지와 라우트 트리가 일반적으로 어떻게 동작하는지를 먼저 확인하세요 — 이 문서는 Next 전용 완결 가이드입니다: 설치 → 선언 → 사용, 그게 전부입니다.

```bash
npm install @hyeonqyu/typed-router-next zod
```

## 1. 트리 선언하기

키가 곧 URL 세그먼트이므로, 트리가 `src/app/` 디렉터리와 그대로 대응됩니다 — `[id]`, `[...slug]`, `(group)`은 Next.js에서와 정확히 같은 의미입니다. 루트인 `app/page.tsx`는 빈 키 `''`로 선언하고, 호출할 때는 그대로 `routes.buildHref('/')`입니다.

```ts
// routes.ts
import { defineRoutes } from '@hyeonqyu/typed-router-next';
import { z } from 'zod';

export const routes = defineRoutes({
  home: {
    _metadata: { title: 'Home' },
  },
  products: {
    _metadata: {
      title: 'Products',
      searchParamsSchema: z.object({
        sort: z.enum(['price-asc', 'price-desc']).optional(),
        page: z.number().default(1),
      }),
    },
    '[id]': {
      _metadata: { title: 'Product detail' },
    },
  },
  '(account)': {
    // 라우트 그룹: 트리를 조직화할 뿐 URL에는 아무것도 추가하지 않음
    profile: { _metadata: { title: 'Profile' } },
  },
});

export const { TypedLink, useCurrentRoute, useTypedParams, useTypedRouter, useTypedSearchParams } = routes;
```

`src/app/` 아래의 폴더들 — `home/`, `products/`, `products/[id]/`, `(account)/profile/` — 은 Next.js가 기대하는 그대로 유지됩니다. `routes`는 아무것도 렌더링하지 않습니다. 이미 있는 구조를 설명할 뿐입니다.

## 2. 네비게이션

```tsx
'use client';
import { useTypedRouter } from './routes';

function Actions() {
  const router = useTypedRouter();

  router.push('/products/[id]', { params: { id: 42 }, scroll: false }); // Next의 `scroll` 옵션이 params/searchParams 옆에 나란히
  router.replace('/products', { searchParams: { sort: 'price-asc' } });
  router.prefetch('/products/[id]', { params: { id: 42 } });
  router.back();
  router.forward();
  router.refresh();
}
```

`push`/`replace`/`prefetch`는 해당 pathname에 대해 트리가 선언한 `params`와 `searchParams`를 정확히 요구합니다 — 무엇이 컴파일되고 무엇이 안 되는지 전체 목록은 프로젝트 개요를 참고하세요.

## 3. 링크

```tsx
import { TypedLink } from './routes';

<TypedLink href="/products/[id]" params={{ id: 42 }}>상세보기</TypedLink>
<TypedLink href="/products" searchParams={{ sort: 'price-asc', page: 2 }} hash="top">정렬됨</TypedLink>
```

`TypedLink`는 `next/link`를 감싸며, 나머지 모든 prop(`className`, `prefetch`, `scroll` 등)을 그대로 전달합니다.

## 4. 현재 라우트 읽기

```tsx
'use client';
import { useTypedParams, useCurrentRoute } from './routes';

function ProductDetail() {
  const params = useTypedParams('/products/[id]');
  params.id; // string

  const { pathname, url, metadata } = useCurrentRoute();
  // /products/42 에서 → pathname: '/products/[id]', url: '/products/42'
}
```

동적 세그먼트는 따로 선언하지 않으면 `string`으로 읽힙니다. 그 세그먼트의 노드에 `paramSchema`를 주면 — `'[id]': { _metadata: { title: 'Detail', paramSchema: z.number() } }` — `params.id`는 검증을 거친 `number`가 되고, `/products/abc`는 잘못된 문자열로 흘러 들어오는 대신 `PathParamsParseError`를 던집니다. 이름은 트리 키에서 오므로 스키마는 객체가 아니라 값 스키마 하나이고, 하위 라우트가 이를 상속합니다. `useTypedSearchParams`와 같은 `onError` 모드를 받습니다.

트리 노드나 선언된 패턴만 필요하다면 `useCurrentRouteNode()`와 `useTypedPathname()`도 사용할 수 있습니다.

## 5. 쿼리 파라미터 읽기 — 그리고 Suspense 규칙

```tsx
'use client';
import { Suspense } from 'react';
import { useTypedSearchParams } from './routes';

export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductsView />
    </Suspense>
  );
}

function ProductsView() {
  const searchParams = useTypedSearchParams('/products');
  searchParams.page; // number — ?page=2는 런타임에도 실제로 숫자 2, "2"가 아님
  searchParams.sort; // 'price-asc' | 'price-desc' | undefined
}
```

`useTypedSearchParams`는 내부적으로 Next의 `useSearchParams`를 사용하며, 이는 페이지를 정적 프리렌더링 대상에서 제외시킵니다. `useSearchParams`를 직접 쓸 때와 동일한 규칙으로, 이를 호출하는 컴포넌트는 `<Suspense>` 경계로 감싸야 합니다. 위처럼 분리하지 않으면 Next 빌드가 정확히 어디가 문제인지 알려줍니다. 전체 패턴은 [`examples/next-example/src/app/products/page.tsx`](../../examples/next-example/src/app/products/page.tsx)를, 이 훅이 받는 `onError` 모드는 프로젝트 개요를 참고하세요.

## 6. 서버 컴포넌트와 훅 없이 사용하기

`routes`는 순수한 데이터이므로 서버 컴포넌트에서 import해도 안전합니다. 훅만 클라이언트 전용입니다.

```ts
// app/page.tsx — 서버 컴포넌트
import { redirect } from 'next/navigation';
import { routes } from './routes';

export default function Index() {
  redirect(routes.buildHref('/home'));
}
```

서버 컴포넌트에서 `useTypedSearchParams` 같은 훅을 호출하면, `useSearchParams`를 거기서 호출했을 때와 정확히 같은 방식으로 실패합니다 — 클라이언트 전용 코드는 자기만의 `'use client'` 경계 뒤에 있으므로, `routes`를 import했다고 해서 서버 번들로 새어 들어가지 않습니다.

## 7. 트리와 `src/app/` 어긋남 잡기

트리는 타입이 붙은 pathname을 주지만, App Router에서 어떤 라우트가 실제로 **존재하는지**를 정하는 것은 `src/app/`입니다. 둘을 이어 주는 장치가 타입 시스템에는 없습니다 — 페이지를 지워도 그리로 가는 링크는 여전히 컴파일되고, 실행하면 404입니다. 반대로 트리에 선언하지 않고 페이지를 추가하면 그 라우트는 살아 있지만 `routes.paths`에는 없습니다.

`assertRoutesMatchAppDir`이 그 틈을 메웁니다. 파일시스템을 읽으므로 별도 엔트리포인트로 배포되고, 브라우저 번들에는 들어가지 않습니다:

```ts
// routes.test.ts
import { assertRoutesMatchAppDir } from '@hyeonqyu/typed-router-next/check';
import { routes } from './routes';

test('라우트 트리가 src/app과 일치한다', () => {
  assertRoutesMatchAppDir(routes, 'src/app');
});
```

실패하면 양쪽 방향을 모두 알려 줍니다 — 페이지가 사라진 라우트와, 트리가 선언한 적 없는 페이지. 던지는 대신 데이터로 받고 싶으면 `findRouteDrift`가 같은 내용을 `{ missingFromAppDir, missingFromTree, inSync }`로 돌려줍니다.

Next의 컨벤션을 Next가 읽는 대로 읽으므로 오탐이 나지 않습니다. 라우트 그룹 `(shop)`과 병렬 라우트 슬롯 `@modal`은 URL 세그먼트를 만들지 않지만 그 **아래**의 페이지는 만듭니다 — `dashboard/@team/settings/page.tsx`는 `/dashboard/settings`로 검사됩니다. Next가 실제로 그 경로를 서빙하기 때문입니다. 반면 인터셉팅 라우트(`(.)`, `(..)`, `(...)`), 프라이빗 폴더(`_folder`), 그리고 페이지가 아닌 모든 파일(`route.ts`, `default.tsx`, `layout.tsx`, `loading.tsx` 등)은 자기 몫의 pathname이 없으므로 아예 무시됩니다. Next의 `pageExtensions`를 바꿨다면 그대로 넘기고, 검사에서 빼고 싶은 경로는 `ignore`에 적습니다:

```ts
assertRoutesMatchAppDir(routes, 'src/app', {
  ignore: ['/admin/*', '/coming-soon'],
  pageExtensions: ['mdx', 'tsx'],
});
```

opt-in인 것은 의도된 설계입니다. 빌드를 막는 검사는 결국 꺼지지만, 자기 테스트 스위트에서 실패하는 검사는 그 앱을 아는 사람이 조정합니다. React Router 어댑터에는 이런 장치가 필요 없습니다 — `toRouteObjects()`가 트리로**부터** 라우터를 만들기 때문에, 거기서는 선언되지 않은 라우트가 존재할 수 없습니다.

## 8. 다른 곳에서 선언한 트리 — `bindRoutes`

여러 앱이 함께 의존하는 공유 패키지에 트리를 둘 수 있습니다. 이때 트리는 `@hyeonqyu/typed-router-core`로 선언해서 프레임워크 의존이 없게 합니다. `bindRoutes`는 이런 트리를 다시 선언하지 않고 이 어댑터의 훅과 `TypedLink`만 붙여 줍니다.

```ts
// routes.ts
import { bindRoutes } from '@hyeonqyu/typed-router-next';
import { routes as shared } from '@acme/shop-routes'; // core의 defineRoutes로 선언

export const routes = bindRoutes(shared);
export const { TypedLink, useTypedRouter, useTypedParams, useTypedSearchParams, useCurrentRoute } = routes;
```

core의 `attachMetadata`를 거친 트리를 포함해 어떤 core 라우트 트리든 받을 수 있고, 경로 목록과 파서는 다시 만들지 않고 그대로 씁니다. 앱에서 메타데이터도 붙여야 한다면 이 패키지의 `attachMetadata` 하나로 두 단계를 같이 처리할 수 있습니다.

## 9. Pages Router

`@hyeonqyu/typed-router-next/pages`는 같은 API를 `next/router` 위에 구현한 엔트리입니다. `defineRoutes`, `attachMetadata`, `bindRoutes`, 인자까지 같은 훅들, `TypedLink`, 같은 재수출을 제공하니 전부 여기서 import하세요. 이 엔트리는 패키지 루트를 로드하지 않기 때문에 Pages Router 번들에 `next/navigation`이 들어오지 않습니다.

```ts
// routes.ts
import { bindRoutes } from '@hyeonqyu/typed-router-next/pages';
import { routes as shared } from '@acme/shop-routes';

export const { TypedLink, useTypedRouter, useTypedParams, useTypedSearchParams, useCurrentRoute } = bindRoutes(shared);
```

키는 `pages/` 구조를 그대로 따릅니다. `pages/products/[id].tsx`는 `products: { '[id]': { _metadata: {} } }`이고, `pages/index.tsx`는 빈 키 `''`입니다. 현재 라우트는 Next가 실제로 렌더한 페이지인 `router.pathname`에서 가져오므로 rewrites가 걸려 있어도 틀리지 않습니다. `useTypedParams`는 App Router와 똑같이 이 값과 대조해서, 맞지 않으면 `RouteMismatchError`를 던집니다.

App Router와 다른 점은 세 가지입니다.

- **`<Suspense>` 대신 `<RouterReady>`를 씁니다.** `getServerSideProps`가 없는 페이지는 빈 `router.query`로 프리렌더되고, query string은 hydration 이후에야 알게 됩니다. 정적 최적화된 동적 라우트라면 세그먼트 값도 마찬가지입니다. 그 전까지 `useTypedSearchParams`는 `RouteNotReadyError`를 던집니다. `useTypedParams`도 세그먼트가 아직 비어 있으면 같은 에러를 던집니다. URL과 다를 수 있는 기본값을 대신 돌려주지 않기 위해서입니다. 이런 컴포넌트는 `RouterReady`로 감싸거나 `useRouterReady()`로 조건을 거세요.

  ```tsx
  import { RouterReady } from '@hyeonqyu/typed-router-next/pages';

  <RouterReady fallback={<Spinner />}>
    <ProductsView />
  </RouterReady>
  ```

  `router.isReady`를 직접 조건으로 쓰면 안 됩니다. query string 없이 정적 렌더된 페이지에서는 프리렌더 HTML에서 `false`인데, 클라이언트 첫 렌더에서는 이미 `true`입니다. 그래서 `isReady ? <View /> : null`은 hydration 불일치를 일으킵니다. `useRouterReady()`는 hydration이 끝날 때까지 `false`를 유지합니다. `getServerSideProps` 페이지는 첫 렌더부터 준비된 상태라 감쌀 필요가 없습니다. `useCurrentRoute`, `useTypedPathname`, `useCurrentRouteNode`는 이 이유로 던지는 일이 없습니다. 어떤 페이지인지는 hydration 전에도 알 수 있기 때문입니다.
- **`push`와 `replace`는 `shallow` 옵션도 받고**, `next/router`의 Promise를 그대로 반환합니다.
- **`refresh()`는 현재 URL로 다시 이동합니다**(`router.replace(router.asPath)`). 클라이언트 상태는 유지한 채 페이지의 데이터 페칭을 다시 실행합니다. Pages Router에는 자체 `refresh`가 없기 때문입니다.

`app/`용 불일치 검사에도 `pages/`용이 있습니다.

```ts
import { assertRoutesMatchPagesDir } from '@hyeonqyu/typed-router-next/check';

test('the route tree matches src/pages', () => {
  assertRoutesMatchPagesDir(routes, 'src/pages');
});
```

`pages/`는 Next가 읽는 방식 그대로 읽습니다. 모든 페이지 파일이 각각 라우트이고, `index` 파일은 자기 폴더 경로를 담당합니다. 루트의 `_app`, `_document`, `_error`, `404`, `500`, `api/`는 건너뜁니다. `(group)`, `@slot`, `_folder`는 App Router 전용 규칙이라 여기서는 평범한 세그먼트로 취급합니다. `findPagesDirDrift`는 `{ missingFromPagesDir, missingFromTree, inSync }`를 반환합니다. `ignore`와 `pageExtensions`는 위와 같이 동작하며, 확장자는 가장 긴 것부터 맞춰 봅니다. 그래서 `pageExtensions: ['page.tsx']`면 `about.page.tsx`가 `/about`이 됩니다.

## 메타데이터

`title`, `label`, `description`, `accessible`은 고정값이거나 컨텍스트 객체를 받는 함수일 수 있습니다. `resolveMetadata`(`@hyeonqyu/typed-router-core`에서, 여기서도 재수출됨)로 이를 해석할 수 있습니다. 전체 설명(`defineRoutes.withMeta` 포함)은 [프로젝트 개요](../../README.ko.md#라우트-메타데이터)를 참고하세요.

## 예제

[`examples/next-example`](../../examples/next-example)는 이 가이드로 만든 완전한 App Router 앱입니다 — `yarn workspace next-example dev`. [`examples/next-pages-example`](../../examples/next-pages-example)는 core로 선언한 트리를 바인딩하는 Pages Router 버전입니다 — `yarn workspace next-pages-example dev`.

## 라이선스

MIT
