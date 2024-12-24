# Wolk

> [!WARNING]
> This is a work in progress and is not published yet.

## What is Wolk?

- An opinionated, batteries-included framework for building serverless functions.
- Built on top of Hono
- Heavily based on async contexts
- Polished APIs
- Includes everything you need for a modern serverless app
  - waitUntil functions
  - Typed environment variables handling
  - A standard way to throw and handle errors
  - Observability
    - Error reporting
    - Tracing through OpenTelemetry
    - Source maps
    - Server-Timing
  - Testing
    - Per-test context
    - Mocks
  - Cache (optional)
- Vendor neutral
  - Adapters for Cloudflare, AWS Lambda, Deno, etc.

## Why another framework?

- Context passing in other frameworks is broken
- We're all solving the same problems: error handling and reporting, logging, speed optimization, testing, etc.

## Features

### Async Contexts

Underpinning all of Wolk are Async Contexts. These make it possible to have global variables, but scoped to the current request.

Take this example: we want every function in our app to have access to the current user. We cannot set it globally, because requests might come in concurrently. We also don't want to pass it around to every function, because that's tedious and error-prone.

```ts
type User = { id: string; name: string };

const userContext = createAsyncContext<User>("user");

function currentUser() {
  return userContext.consume();
}

export default {
  fetch(req: Request) {
    const user = await auth(req.headers.get("Authorization"));

    return userContext.provide(user, () => route(req));
  },
};

async function route(req: Request) {
  return new Response("Hello, " + currentUser()?.name ?? "stranger");
}
```

### `waitUntil` and `onTeardown`

In most apps, you don't want to wait for all async operations to finish before returning a response. That's why `waitUntil` exists. On platforms like Cloudflare Workers, it's attached to the execution context object, so you have to pass it around. Wolk makes it available on an async context.

```ts
import { waitUntil } from "wolk";

function count(): void {
  waitUntil(fetch("https://counter.com?increment=1"));
}
```

In the above example, running `count` multiple times will result in multiple requests. It's more efficient to batch them:

```ts
import { waitUntil, onTeardown } from "wolk";

const countContext = createAsyncContext<{ count: number }>("count");

function count(): void {
  countContext.consume().count++;
}

export default {
  fetch(req: Request) {
    countContext.provide({ count: 0 }, () => {
      onTeardown(() => {
        waitUntil(
          fetch(`https://counter.com?increment=${countContext.consume().count}`)
        );
      });

      waitUntil(
        (async () => {
          await delay(1000);
          count();
          count();
        })()
      );

      return route(req);
    });
  },
};
```

In the above example, the `count` function is called twice, but the request to `https://counter.com?increment=2` is only made once.
`onTeardown` is called after all the called `waitUntil`s are resolved.

These functions also support nesting, so you can have multiple levels of teardown functions.


### Environment variables

`env` has three methods: `get`, `getOptional`, and `isTrue` (checks if the value is "true")

```ts
export const [env, provideEnv] = createEnvContext<Env>();

type Env = { API_KEY: string };

export default {
  fetch(req: Request, env: Env) {
    provideEnv(env, () => route(req));
  },
};

function route(req: Request) {
  return new Response(env.get("API_KEY"));
}
```

### Error handling

Wolk provides a standard way to throw and handle errors. This makes it easy to report errors to your error tracking service, and to handle them in a consistent way.

You can attach information to errors, which will be passed to your error tracking service. You can also mark error info as public, which will be returned to the client.

```ts
import { WolkError } from "wolk/errors";

export class TrackingError extends WolkError.extend({
  name: "TrackingError"
});

export class ApiTrackingError extends TrackingError.extend({
  name: "ApiTrackingError"
});

export class ValidationTrackingError extends TrackingError.extend({
  name: "ValidationTrackingError",
  infoIsPublic: true,
  httpStatus: 400,
});

async function trackOrder(orderId: string) {
  if (!orderId) {
    throw new ValidationTrackingError({
      message: "Missing orderId",
      info: {
        orderId,
      }
    });
  }
  const response = await fetch(`https://tracker.com/orders/${orderId}`);
  if (!response.ok) {
    throw new ApiTrackingError({
      message: "API error",
      info: {
        response: {
          status: response.status,
          body: await response.text(),
        },
        request: {
          orderId,
        }
      }
    })
  }
  return response.json();
}
```

Info can also be typed.

```ts
import { WolkError } from "wolk/errors";

export class UserError extends WolkError.extend<{ userId: string }>({
  name: "UserError"
});
```

### Error reporting

Wolk provides a simple API for reporting errors to your error tracking service.

Because the errors are different classes, it's easy to distinguish between them in your error tracking service.

```ts
import { report } from "wolk/observability";

try {
  await trackOrder("123");
} catch (error) {
  report(error);
}
```

### Tracing

The OpenTelemetry API is tedious and unclear, so Wolk provides a simple API for tracing.

```ts
import { trace } from "wolk/observability";

function fetchOrder(orderId: string) {
  return trace({
    name: "fetchOrder",
    attributes: {
      "request.orderId": orderId,
    },
  }, async () => {
    const response = await fetch(`https://api.com/orders/${orderId}`);
    return response.json();
  });
}
```