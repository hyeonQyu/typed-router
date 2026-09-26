# typed-router

[English](./README.md) | **한국어**

## 언제 필요한가

라우트 경로와 쿼리 파라미터는 보통 그냥 문자열입니다. 컴파일러는 `/products/[id]`에 `id`가 필요하다는 것도, `?sort=`가 세 가지 값만 받는다는 것도, 이름을 바꾼 페이지를 가리키는 링크 세 개가 여전히 옛날 경로를 향하고 있다는 것도 알려주지 않습니다. 이런 버그는 런타임에, 그것도 발견된다면 다행인 시점에 드러납니다.

typed-router는 라우트 맵 전체를 타입이 있는 객체 하나로 만듭니다. 한 번만 선언하면 pathname, 경로 파라미터, 쿼리 파라미터의 타입, 네비게이션, (React Router의 경우) 라우터 설정 자체까지 — 전부 그 선언 하나에서 파생되고 컴파일러가 검증합니다.

```bash
npm install @hyeonqyu/typed-router-next zod   # Next.js App Router
npm install @hyeonqyu/typed-router-react zod  # React Router
```

`zod`는 선택 사항입니다 — search param 스키마를 선언하는 라우트에서만 필요하며, [Standard Schema](https://standardschema.dev)를 따르는 검증 라이브러리라면 무엇이든 사용할 수 있습니다.

**이미 쓸 스택이 정해져 있다면?** 각 가이드는 독립적으로 완결됩니다. 여러분 것만 읽으세요:

- **[Next.js App Router →](./packages/next/README.ko.md)**
- **[React Router →](./packages/react/README.ko.md)**

이 페이지의 나머지는 두 가이드가 공통으로 딛고 있는 개념을 설명합니다.

## 라우트 트리

라우트 트리는 중첩된 객체입니다. 각 키는 URL 세그먼트이고, 노드는 `_metadata` 블록을 갖는 순간 실제로 이동 가능한 라우트가 됩니다.

```ts
// -next 또는 -react 에서 import — 아래 선언은 어느 쪽이든 동일합니다.
import { defineRoutes } from '@hyeonqyu/typed-router-next';
import { z } from 'zod';

export const routes = defineRoutes({
  cart: {
    _metadata: { title: 'Cart' },
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
});
```

제네릭도, 커링 호출도, 앱을 감싸야 하는 프로바이더도 없습니다. 키 문법은 Next.js에서 그대로 가져왔으므로, 트리가 `app/` 디렉터리 구조와 그대로 대응됩니다.

| 키 | 의미 |
| --- | --- |
| `products` | 정적 세그먼트 |
| `[id]` | 필수 동적 세그먼트 |
| `[...slug]` | 필수 catch-all (하나 이상의 세그먼트) |
| `[[...slug]]` | 선택적 catch-all (0개 이상의 세그먼트) |
| `(group)` | URL 세그먼트를 추가하지 않고 트리를 조직화 |
| `''` (빈 키) | 루트, 즉 `/` |
| `_metadata`가 없는 노드 | 자식들을 네임스페이스하지만 그 자체는 목적지가 아님 |

### 루트 라우트

경로는 노드의 키를 부모의 경로에 이어 붙여 만들어지므로, 빈 키는 정확히 `/`가 됩니다.

```ts
const routes = defineRoutes({
  '': { _metadata: { title: 'Home' } },
  products: { _metadata: { title: 'Products' } },
});

routes.paths;               // ['/', '/products']
routes.buildHref('/');      // '/'
routes.getMetadata('/');    // { title: 'Home' }
routes.match('/')?.path;    // '/'
```

키는 `''`이지만 pathname은 `/`입니다 — 쓰는 방식과 부르는 방식이 다를 뿐입니다. 선언하면 `/`도 여느 라우트와 똑같아지고, 빠뜨리면 `/`는 트리가 이름 부를 수 없는 실제 URL로 남습니다. Next에서 `assertRoutesMatchAppDir`가 보고하는 어긋남이 바로 이것입니다.

루트는 자식을 갖지 않습니다. `app/page.tsx`는 파일이므로 다른 모든 라우트는 루트의 자식이 아니라 형제입니다. `''` 아래에 중첩하면 구분자가 겹쳐(`//dashboard`) 아무것도 매치되지 않습니다.

## 타입 안전한 네비게이션

이 선언으로부터 `routes`는 모든 pathname(`/products`, `/products/[id]`, `/cart`, …)을 컴파일 타임 문자열 유니온으로 뽑아내고 — 실제로 버그를 잡아내는 부분인데 — 각 pathname을 정확히 그것이 필요로 하는 인자에 묶습니다. `useTypedRouter()`는 `routes`가 제공하는 훅 중 하나이며, 나머지는 두 프레임워크 가이드에서 각각 다룹니다.

```ts
const router = useTypedRouter();

router.push('/products/[id]', { params: { id: 42 } });          // ✅
router.push('/products', { searchParams: { sort: 'price-asc' } }); // ✅
router.push('/cart');                                            // ✅ 아무것도 필요 없음

router.push('/products/[id]');            // ❌ params.id가 필수
router.push('/produtcs');                 // ❌ 존재하지 않는 경로
router.push('/products', { searchParams: { sort: 'cheap' } });  // ❌ enum에 없는 값
router.push('/products', { searchParams: { pge: 1 } });         // ❌ 존재하지 않는 키
router.push('/cart', { searchParams: { anything: 1 } });        // ❌ /cart는 스키마가 없음
router.push('/products', { params: { id: 1 } });                // ❌ 동적 세그먼트가 없는 경로
```

경로 파라미터(`params`)와 쿼리 파라미터(`searchParams`)는 항상 별개의 인자이므로, 어느 쪽이 URL을 채우고 어느 쪽이 쿼리 스트링을 채우는지 모호할 일이 없습니다.

## 파라미터 다시 읽기

쿼리 파라미터를 읽을 때는 스키마를 실제로 실행합니다 — URL에서 오는 값은 전부 문자열이므로, 각 필드 자신의 스키마에게 어떤 해석을 받아들이는지 물어봅니다. `z.number()` 필드는 `"2"`가 아니라 `2`를 받고, `z.string()` 필드는 `"0123"`을 그대로 유지하며, `.default()` 값도 채워집니다.

쓰기 쪽도 이에 맞춰 동작합니다. 객체와 중첩 배열은 JSON으로 쿼리 스트링에 들어가므로, `{ f: { min: 1, max: 9 } }`는 같은 객체로 다시 읽힙니다. 충실한 문자열 표현이 없는 값 — `NaN`, 심볼, `Map`, 순환 참조 객체 — 은 `[object Object]`로 URL에 들어가는 대신 URL을 만드는 그 자리에서 예외를 던집니다. `Date`는 ISO 문자열로 쓰이므로 해당 필드는 `z.coerce.date()`로 선언하세요. 순수한 `z.date()`는 typed-router가 스스로 만든 URL조차 다시 읽지 못합니다.

### 경로 파라미터도 똑같이 다뤄집니다

동적 세그먼트는 따로 선언하지 않으면 문자열로 읽힙니다. `paramSchema`를 붙이면 그 스키마가 만들어내는 타입으로, 검증을 거쳐 읽힙니다. 세그먼트의 *이름*은 이미 트리 키가 갖고 있으므로 타입만 적습니다.

```ts
const routes = defineRoutes({
  orgs: {
    '[orgId]': {
      _metadata: { title: 'Org', paramSchema: z.number() },

      projects: {
        _metadata: { title: 'Projects' },     // 아무것도 선언하지 않지만 orgId: number를 상속
      },
    },
  },
});

const { orgId } = useTypedParams('/orgs/[orgId]/projects');
//      ^? number — 호출부에서 `Number(orgId)`를 쓸 필요가 없습니다

routes.buildHref('/orgs/[orgId]', { params: { orgId: 'abc' } });  // ❌ orgId는 z.number()를 선언함
// 브라우저에서 /orgs/abc → PathParamsParseError
```

중첩 라우트는 모든 조상 세그먼트의 선언을 상속하므로, 동적 세그먼트마다 정확히 한 번씩만 선언합니다. catch-all은 읽어들이는 배열 전체를 선언합니다 — `[...date]`에 `paramSchema: z.array(z.number())`를 주면 `{ date: number[] }`가 됩니다.

이 기능은 세그먼트 단위 opt-in입니다. `paramSchema`가 없는 세그먼트는 이전과 똑같이 `string`(또는 `string[]`)으로 읽힙니다.

### URL이 검증에 실패했을 때

URL의 양쪽 절반이 같은 방식으로, 같은 세 가지 모드로 답합니다.

```ts
useTypedSearchParams('/search', { onError: 'throw' });   // 기본값 — 잘못된 링크를 조기에 드러냄
useTypedSearchParams('/search', { onError: 'default' }); // 잘못된 필드만 버리고 나머지는 유지
useTypedSearchParams('/search', { onError: 'raw' });     // 던지는 대신 변환된 값을 그대로 반환

useTypedParams('/orgs/[orgId]', { onError: 'default' }); // 같은 모드, 같은 의미
```

`throw`는 `SearchParamsParseError` 또는 `PathParamsParseError`를 던지며, 후자는 실패한 세그먼트 이름을 `.param`에 담습니다.

### 넘긴 pathname은 검증됩니다

`useTypedParams('/products/[id]')`는 파라미터를 *그 라우트로서* 읽으므로, 그 라우트가 실제로 현재 렌더링되고 있는 라우트여야 합니다. 이 인자는 믿는 대신 URL과 대조합니다.

```ts
// /products/42/reviews 아래에서 렌더링될 때:
useTypedParams('/products/[id]');          // ✅ 조상 — `id`는 실제로 이 URL에 있습니다
useTypedParams('/products/[id]/reviews');  // ✅ 매치된 라우트 자신
useTypedParams('/docs/[...slug]');         // ❌ RouteMismatchError
```

조상을 허용하는 이유는, 더 깊은 곳에서 렌더링되는 공유 컴포넌트가 상위 라우트의 파라미터를 읽는 것이 정당하기 때문입니다. 그 밖의 경우는 `RouteMismatchError`를 던지며, 넘긴 라우트와 URL이 실제로 매치한 라우트를 함께 알려줍니다. 어떤 라우트에도 매치되지 않는 URL도 마찬가지입니다. 이 검사가 없으면 그 호출은 다른 라우트의 파라미터를 이 라우트의 타입으로 돌려주고, 그것은 타입 검사를 통과하면서 그냥 틀린 값입니다.

`useCurrentRouteNode(pathname)`도 같은 인자를 받아 같은 검사를 합니다. 인자 없이 부르면 예전처럼 검증하지 않으며, 그때 반환 타입은 선언된 모든 노드의 유니온입니다 — 검증하지 않는 호출이 정직하게 약속할 수 있는 전부이기 때문입니다.

## 라우트 메타데이터

`_metadata`는 노드마다 개별적으로 추론되므로, 각 라우트는 서로 다른 필드를 가질 수 있습니다 — `title`, `label`, `description`, `accessible`은 고정값이거나 앱 컨텍스트를 받는 함수일 수 있습니다.

```ts
import { resolveMetadata } from '@hyeonqyu/typed-router-core';

const meta = resolveMetadata(routes.getMetadata('/cart'), { locale, userId });
```

모든 노드가 하나의 메타데이터 계약을 공유하길 원한다면, 명시적으로 opt-in 할 수 있습니다.

```ts
const routes = defineRoutes.withMeta<{ name: string }, { locale: string }>()({ ... });
```

이 계약은 깊이에 상관없이 강제됩니다. `_metadata`를 선언한 노드는 어느 깊이에 있든 계약을 온전히 만족해야 하며, 그러면서도 노드별 추론은 그대로라 각 라우트의 리터럴 타입과 추가로 선언한 필드가 살아남습니다.

```ts
const routes = defineRoutes.withMeta<{ title: string; icon: string }>()({
  home: { _metadata: { title: 'Home', icon: 'house', badge: 'new' } },  // ✅ 추가 필드는 유지됩니다
  products: {
    _metadata: { title: 'Products', icon: 'box' },
    '[id]': { _metadata: { title: 'Detail' } },                          // ❌ icon이 없습니다
  },
});

routes.getMetadata('/home').title;   // 'Home' — `string`이 아니라 여전히 리터럴
routes.getMetadata('/home').badge;   // 'new'  — 계약은 하한이지 상한이 아닙니다
```

`_metadata` 자체가 없는 노드는 라우트가 아니라 조직용이므로, 계약이 강제할 대상이 없습니다.

### 트리를 한 단계만 훑기

`paths`와 `collected`는 트리 전체를 평탄화합니다. 메뉴 한 단계, 브레드크럼의 형제 항목, 섹션 인덱스는 그 반대 — *한* 노드의 자식들 — 이고, 여기서 `Object.values(node)`를 쓰면 실제 자식과 함께 `_metadata` 블록이 딸려 나와 유령 항목으로 렌더됩니다. `children()`은 자식만 돌려줍니다:

```ts
import { children } from '@hyeonqyu/typed-router-core';

const support = routes.routes.support;

Object.keys(support);              // ['_metadata', 'ask', 'notice'] — 메타데이터가 섞여 나온다
Object.keys(children(support));    // ['ask', 'notice']

Object.entries(children(support)).map(([key, node]) => ({
  key,
  title: node._metadata.title,     // 노드별로 타입이 붙는다, 캐스팅 없이
}));
```

배열이 아니라 객체를 돌려주므로 `keys`·`values`·`entries`가 모두 그대로 동작하고, 타입 `RouteChildren<TNode>`가 노드에서 `_metadata`를 걷어내되 각 자식은 선언 당시의 리터럴 타입을 유지합니다. 경로를 확인하지 않은 `useCurrentRouteNode()`가 돌려주는 것 같은 노드 유니언도, 공통 키만 남기고 무너지는 대신 멤버별로 각각 걷어냅니다. 라우트 그룹 키 `(name)`도 다른 자식과 똑같이 포함됩니다 — 그룹은 트리를 조직하는 장치이고, 특정 메뉴에서 그룹을 어떻게 다룰지는 여러분이 정할 문제입니다.

트리 자체는 건드리지 않습니다. `_metadata`는 여전히 평범한 열거 가능 속성이라 노드는 스프레드·`structuredClone`·`toEqual`을 그대로 통과합니다. 선언된 트리의 같은 노드로 `children()`을 두 번 부르면 같은 동결 객체가 돌아오므로, 결과를 의존성 배열에 그대로 넣어도 재렌더가 생기지 않습니다.

## 프레임워크 독립적인 사용

라우트 트리는 순수한 데이터입니다. `@hyeonqyu/typed-router-core`는 React 의존성이 전혀 없는 동일한 선언 방식을 제공합니다 — 스크립트, 테스트, sitemap 생성기 같은 곳에서요. 그리고 각 프레임워크 패키지에서 얻는 `routes` 객체도 훅들과 함께 이 메서드들을 똑같이 가지고 있습니다.

```ts
import { defineRoutes } from '@hyeonqyu/typed-router-core';

const routes = defineRoutes({ /* 위와 같은 형태 */ });

routes.paths;                        // 선언된 모든 pathname
routes.buildHref('/products/[id]', { params: { id: 42 } }); // '/products/42'
routes.match('/products/42');        // → { path: '/products/[id]', params: { id: '42' }, node, metadata }
routes.getMetadata('/products');
routes.parseSearchParams('/products', new URLSearchParams(search));
routes.parseParams('/orgs/[orgId]', { orgId: '42' });       // { orgId: 42 } — 세그먼트 스키마에 따라
```

## 어떤 라우트가 존재하는가

React Router에서는 트리가 이걸 스스로 결정합니다 — `toRouteObjects()`가 트리로**부터** 라우터 설정을 만들기 때문에, 선언되지 않은 라우트는 존재할 수 없습니다.

`_metadata`에 페이지를 지정하지 않은 노드 — `element`도 `Component`도 `lazy`도 없는 — 역시 라우트가 되며, 매치는 되지만 아무것도 그리지 않습니다. 이는 의도된 동작입니다. 트리는 정보 구조를 선언하는 것이고, 어떤 노드는 이 라우터가 그릴 페이지 없이 자리만 차지할 수 있습니다. 그런 경로가 404가 되어야 한다면 노드에 페이지를 주거나 설정에서 빼세요. 이미 매치되었기 때문에 뒤에 둔 `{ path: '*' }`는 잡지 못합니다.

Next의 App Router는 반대입니다. 어떤 라우트가 존재하는지는 `src/app/`이 정하고 트리는 그걸 손으로 따라 씁니다. 컴파일러는 둘의 일치를 검사할 수 없지만, `@hyeonqyu/typed-router-next/check`는 할 수 있습니다:

```ts
import { assertRoutesMatchAppDir } from '@hyeonqyu/typed-router-next/check';
import { routes } from './routes';

test('라우트 트리가 src/app과 일치한다', () => {
  assertRoutesMatchAppDir(routes, 'src/app');
});
```

양방향을 모두 보고합니다 — 페이지가 지워진 선언된 라우트, 그리고 트리가 선언한 적 없는 페이지. Next의 컨벤션을 Next와 똑같이 읽습니다: `(group)`과 `@slot` 폴더는 URL 세그먼트를 만들지 않지만 그 아래 페이지는 그대로 라우트로 세고, `(.)` 인터셉트·`_folder`·`route.ts`·`default.tsx`는 자기 pathname이 아예 없습니다. 파일시스템을 읽으므로 별도 엔트리포인트에 있고 브라우저 번들에는 들어가지 않습니다. [자세한 내용은 Next 가이드](./packages/next/README.ko.md#7-트리와-srcapp-어긋남-잡기).

## 패키지 구성

| 패키지 | 용도 |
| --- | --- |
| `@hyeonqyu/typed-router-core` | 트리, 타입, URL 헬퍼 — 프레임워크 독립적 |
| [`@hyeonqyu/typed-router-next`](./packages/next/README.ko.md) | Next.js App Router |
| [`@hyeonqyu/typed-router-react`](./packages/react/README.ko.md) | React Router 6/7 라이브러리 모드 |

### React Router 7 framework mode

React 어댑터는 React Router의 **라이브러리 모드** — 라우터 설정을 직접 소유하는 쪽 — 를 위해 만들어졌습니다. **framework mode**(`@react-router/dev`, `app/routes.ts` 설정)에서는 `toRouteObjects()`를 쓸 수 없습니다. 이쪽은 런타임에 해석되는 React 엘리먼트인 `element` / `Component`를 내보내는데, framework mode의 `RouteConfigEntry`는 빌드 타임에 해석해서 라우트마다 코드 스플리팅하고 타입을 생성할 수 있는 모듈 경로 `file`을 원하기 때문입니다. 같은 라우트를 서로 읽을 수 없는 단위로 기술하는 셈입니다.

나머지는 그대로 쓸 수 있습니다. 애초에 라우터에 의존한 적이 없기 때문입니다 — `paths`, `buildHref`, `match`, `parseParams`, `parseSearchParams`, `getMetadata`, `collected` 전부 그대로 동작합니다. `_metadata`에 `element` 대신 `file`을 선언하면 트리가 framework 설정을 열다섯 줄 정도로 만들어냅니다. [`examples/react-router-framework-example`](./examples/react-router-framework-example)이 정확히 그렇게 하고 있고, `tests/framework-mode.test.ts`가 그 결과를 고정합니다.

framework mode에서는 React 어댑터 대신 `@hyeonqyu/typed-router-core`에서 import하세요. 프레임워크가 자체 `<Link>`와 훅을 제공하므로, 어댑터의 것은 이미 답이 있는 질문에 대한 두 번째 답이 됩니다.

## 예제

실행 가능한 앱이 세 개 있습니다. 앞의 둘은 *같은* 트리를 선언하고 컴포넌트 코드를 그대로 공유합니다 — API가 어댑터 간에 진짜로 동일하다는 증거입니다.

```bash
yarn workspace next-example dev                      # http://localhost:3000
yarn workspace react-example dev                     # http://localhost:5173
yarn workspace react-router-framework-example dev    # http://localhost:5174
```

React 예제에는 `routes.collected`와 `resolveMetadata`로 만든 권한 기반 메뉴도 들어 있어서, `accessible` 메타데이터 빌트인이 설명에 그치지 않고 실제로 동작하는 모습을 보여줍니다.

## 1.x에서 업그레이드하기

2.0은 breaking rewrite입니다. [MIGRATION.md](./MIGRATION.md)를 참고하세요. (현재 마이그레이션 가이드는 영문으로만 제공됩니다.)

## 개발

```bash
yarn install
yarn build   # 모든 패키지 + 예제들
yarn type    # 모든 워크스페이스 타입 체크 (예제가 `dist`를 참조하므로 패키지를 먼저 빌드합니다)
yarn test    # 타입 레벨 어서션, 이어서 런타임·렌더링 스위트
yarn lint
```

`yarn test`는 두 개의 스위트입니다. `tsc -p tests/tsconfig.json`이 타입 레벨 어서션을 돌립니다 — 절반은 정상 통과해야 하는 어서션이고 절반은 `@ts-expect-error`라서, 컴파일되어야 할 코드가 깨졌을 때뿐 아니라 막혀야 할 코드가 몰래 통과하기 시작했을 때도 실패합니다. 그다음 `vitest`가 런타임에만 존재하는 것들을 전부 돌립니다: 프레임워크 독립 스위트, jsdom + Testing Library로 실제 렌더링하는 두 어댑터, 그리고 일회용 `app/` 디렉터리를 디스크에 만들어 검증하는 드리프트 체크. 이 모두가 패키지를 `src`로 해석하므로, 통과한 테스트가 이미 사라진 코드를 설명하는 일은 생기지 않습니다.

CI는 모든 PR에서 Node 20과 22 두 버전에 대해 `lint`, `type`, `test`, `build`를 실행합니다.

## 라이선스

MIT
