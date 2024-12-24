import { AsyncLocalStorage } from "node:async_hooks";
import { expect, it } from "vitest";
import { InternalWolkError } from "./internal/internal-error";

type WrapFn<T> = <R>(value: T, fn: () => R) => () => R;

export type WolkAsyncContext<T> = {
	consume(): T;
	provide: WrapFn<T>;
};

/**
 * Wrapper over `AsyncLocalStorage`, inspired by the `AsyncContext` proposal.
 */
export function createAsyncContext<T>(
	name: string,
	{ allowUndefined }: { allowUndefined?: boolean } = {},
): WolkAsyncContext<T> {
	const base = new AsyncLocalStorage<T>();
	const context: WolkAsyncContext<T> = {
		consume() {
			const value = base.getStore();
			if (value === undefined && !allowUndefined) {
				throw new InternalWolkError({
					message: `Attempted to consume ${name} context outside of a context provider`,
					info: { contextName: name },
				});
			}
			return value as T;
		},
		provide(value, fn) {
			return () => base.run(value, fn);
		},
	};
	return context;
}

/**
 * Wrapper over `AsyncLocalStorage.bind`.
 * Binds all the contexts from when this function is called to the function, which can be executed later.
 */
export function bindCurrentAsyncContexts<F extends (...args: unknown[]) => unknown>(
	fn: F,
): F {
	return AsyncLocalStorage.bind(fn);
}

if (import.meta.vitest) {
	function delay(ms: number) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	it("handles sync fns", async () => {
		const nContext = createAsyncContext<number>("n");
		const fn = () => {
			return nContext.consume() + 1;
		};
		const wrappedFn = nContext.provide(1, fn);
		expect(wrappedFn()).toBe(2);
	});

	it("handles async fns", async () => {
		const nContext = createAsyncContext<number>("n");
		const fn = async () => {
			return nContext.consume() + 1;
		};
		const wrappedFn = nContext.provide(1, fn);
		expect(await wrappedFn()).toBe(2);
	});

	it("keeps contexts separated", async () => {
		const nContext = createAsyncContext<number>("n");
		const fn = async () => {
			await delay(100);
			return nContext.consume() + 1;
		};
		const wrapped1 = nContext.provide(1, fn);
		const wrapped2 = nContext.provide(2, fn);
		const wrapped3 = nContext.provide(3, fn);
		const [result1, result2, result3] = await Promise.all([
			wrapped1(),
			wrapped2(),
			wrapped3(),
		]);
		expect(result1).toBe(2);
		expect(result2).toBe(3);
		expect(result3).toBe(4);
	});
}
