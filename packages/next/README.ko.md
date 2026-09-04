# @hyeonqyu/typed-router-next

[English](./README.md) | **한국어**

Next.js App Router를 위한 타입 안전 라우팅입니다. typed-router가 처음이라면 [프로젝트 개요](../../README.ko.md)에서 왜 만들어졌는지와 라우트 트리가 일반적으로 어떻게 동작하는지를 먼저 확인하세요 — 이 문서는 Next 전용 완결 가이드입니다: 설치 → 선언 → 사용, 그게 전부입니다.

```bash
npm install @hyeonqyu/typed-router-next zod
```

Next 내장 `typedRoutes`나 `nextjs-routes`, `pathpida`, `next-typesafe-url`, `next-safe-navigation`과 놓고 고민 중이라면 [Next.js 기준 비교](../../COMPARISON.ko.md#nextjs를-쓴다면)를 먼저 보세요.

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

## 메타데이터

`title`, `label`, `description`, `accessible`은 고정값이거나 컨텍스트 객체를 받는 함수일 수 있습니다. `resolveMetadata`(`@hyeonqyu/typed-router-core`에서, 여기서도 재수출됨)로 이를 해석할 수 있습니다. 전체 설명(`defineRoutes.withMeta` 포함)은 [프로젝트 개요](../../README.ko.md#라우트-메타데이터)를 참고하세요.

## 예제

[`examples/next-example`](../../examples/next-example)는 이 가이드로 만든 완전한 앱입니다 — `yarn workspace next-example dev`.

## 라이선스

MIT
