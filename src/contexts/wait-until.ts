import { bindCurrentAsyncContexts, createAsyncContext } from "../context";
import { WaitUntilList } from "wait-until-generalized";
import { expect, it } from "vitest";
import {
	onUnhandledError,
	reportUnhandledError,
} from "../globals/unhandled-error";

export type WaitUntilFn = (promise: Promise<unknown>) => void;

export function createWaitUntilContext() {
	const waitUntilContext = createAsyncContext<WaitUntilFn>("waitUntil", {
		allowUndefined: true,
	});
	const teardownFnsListContext =
		createAsyncContext<(() => void)[]>("teardownFnsList");
	const isInsideTeardownContext = createAsyncContext<boolean>(
		"isInsideTeardown",
		{ allowUndefined: true },
	);

	function waitUntil(promise: Promise<unknown>) {
		const waitUntilFn = waitUntilContext.consume();
		if (!waitUntilFn) {
			reportUnhandledError(
				new Error("waitUntil called outside of a waitUntil context"),
			);
			return;
		}
		waitUntilFn(promise);
	}

	function onTeardown(fn: () => void) {
		if (isInsideTeardownContext.consume()) {
			reportUnhandledError(
				new Error("onTeardown cannot be called inside of another onTeardown function"),
			);
			return;
		}
		const teardownFnsList = teardownFnsListContext.consume();
		// bind the local context from when `onTeardown` is called
		// to the function, so that `report` etc are available.
		teardownFnsList.unshift(
			bindCurrentAsyncContexts(() =>
				isInsideTeardownContext.provide(true, fn)(),
			),
		);
	}

	function runTeardown() {
		const teardownFnsList = teardownFnsListContext.consume();
		for (const fn of teardownFnsList) {
			fn();
		}
	}

	/** Provide `waitUntil` and `onTeardown` to `fn` */
	function provide<R>(
		rootWaitUntil: WaitUntilFn,
		fn: () => R,
	): () => Promise<Awaited<R>> {
		// use the waitUntil from the parent context if it's nested
		const parentWaitUntil = waitUntilContext.consume() ?? rootWaitUntil;

		const list = new WaitUntilList();
		function childWaitUntil(promise: Promise<unknown>) {
			if (!list.settled) {
				list.waitUntil(promise);
				return;
			}
			// when calling waitUntil in a teardown function, it needs to be passed to the
			// native waitUntil, so that it will be awaited
			parentWaitUntil(promise);
			if (!isInsideTeardownContext.consume()) {
				reportUnhandledError(
					new Error(
						"waitUntil called when list already settled and not in a teardown function",
					),
				);
			}
		}

		return teardownFnsListContext.provide([], () => {
			return waitUntilContext.provide(childWaitUntil, async () => {
				const result = await fn();

				parentWaitUntil(list.waitUntilSettled().then(() => runTeardown()));

				return result;
			})() as Promise<Awaited<R>>;
		});
	}

	return [
		{
			waitUntil,
			onTeardown,
		},
		provide,
	] as const;
}

if (import.meta.vitest) {
	function createMockNativeWaitUntil() {
		return new WaitUntilList();
	}

	function delay(ms: number) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	it("makes sync functions async", async () => {
		const fn = () => 1;
		const native = createMockNativeWaitUntil();
		const [_, provide] = createWaitUntilContext();
		const wrapped = provide(native.waitUntil, fn);
		expect(await wrapped()).toBe(1);
	});

	it("keeps async functions async", async () => {
		const fn = async () => 1;
		const native = createMockNativeWaitUntil();
		const [_, provide] = createWaitUntilContext();
		const wrapped = provide(native.waitUntil, fn);
		expect(await wrapped()).toBe(1);
	});

	it("can consume contexts inside of teardown functions", async () => {
		const [{ waitUntil, onTeardown }, provideWaitUntil] =
			createWaitUntilContext();
		const native = createMockNativeWaitUntil();
		const nContext = createAsyncContext<number>("n");
		let teardownRan = false;
		let waitUntilInTeardownRan = false;
		const fn = async () => {
			onTeardown(() => {
				expect(nContext.consume()).toBe(1);
				waitUntil(
					(async () => {
						await delay(100);
						expect(nContext.consume()).toBe(1);
						waitUntilInTeardownRan = true;
					})(),
				);
				teardownRan = true;
			});
			return nContext.consume();
		};
		const wrapped = nContext.provide(1, provideWaitUntil(native.waitUntil, fn));
		expect(await wrapped()).toBe(1);
		await native.waitUntilSettled();
		expect(teardownRan).toBe(true);
		expect(waitUntilInTeardownRan).toBe(true);
	});

	it("throws unhandled error when calling waitUntil after it's settled", async () => {
		const native = createMockNativeWaitUntil();
		const [{ waitUntil }, provide] = createWaitUntilContext();
		let unhandledError: unknown;
		const unsub = onUnhandledError((error) => {
			unhandledError = error;
		});
		const wrapped = provide(native.waitUntil, async () => {
			await delay(10);
			setTimeout(() => {
				waitUntil(Promise.resolve());
			});
		});
		await wrapped();
		await delay(20);
		expect(unhandledError?.toString()).toContain(
			"waitUntil called when list already settled",
		);
		await native.waitUntilSettled();
		unsub();
	});

	it("runs teardown functions in the inverse order they were added", async () => {
		const [{ onTeardown }, provide] = createWaitUntilContext();
		const native = createMockNativeWaitUntil();
		const order: number[] = [];
		await provide(native.waitUntil, async () => {
			onTeardown(() => order.push(1));
			onTeardown(() => order.push(2));
			onTeardown(() => order.push(3));
		})();
		await native.waitUntilSettled();
		expect(order).toEqual([3, 2, 1]);
	});

	it("does onTeardown batching correctly", async () => {
		const [{ onTeardown, waitUntil }, provide] = createWaitUntilContext();
		const native = createMockNativeWaitUntil();
		let finalCount = 0;

		const countContext = createAsyncContext<{ count: number }>("count");

		function count(): void {
			countContext.consume().count++;
		}

		await provide(native.waitUntil, async () => {
			countContext.provide({ count: 0 }, () => {
				onTeardown(() => {
					finalCount = countContext.consume().count;
				});

				waitUntil(
					(async () => {
						await delay(100);
						count();
						count();
					})(),
				);
			})();
		})();
		await native.waitUntilSettled();
		expect(finalCount).toBe(2);
	});

	it("throws when nesting onTeardown calls", async () => {
		const [{ onTeardown }, provide] = createWaitUntilContext();
		const native = createMockNativeWaitUntil();
		let unhandledError: unknown;
		const unsub = onUnhandledError((error) => {
			unhandledError = error;
		});
		await provide(native.waitUntil, async () => {
			onTeardown(() => {
				onTeardown(() => {});
			});
		})();
		await native.waitUntilSettled();
		expect(unhandledError?.toString()).toContain(
			"onTeardown cannot be called inside of another onTeardown function",
		);
		unsub();
	});

	it("can handle nested wait until contexts", async () => {
		function delay(ms: number) {
			return new Promise((resolve) => setTimeout(resolve, ms));
		}

		const [{ waitUntil, onTeardown }, provide] = createWaitUntilContext();
		const native = createMockNativeWaitUntil();
		const events: string[] = [];
		function addEvent(event: string) {
			events.push(event);
		}
		let teardownCalled = false;
		const t1 = performance.now();
		await provide(native.waitUntil, async () => {
			onTeardown(() => {
				addEvent("lvl 1 teardown");
			});
			await provide(native.waitUntil, async () => {
				waitUntil(delay(100));
				onTeardown(() => {
					teardownCalled = true;
					addEvent("lvl 2 teardown");
				});
			})();
		})();
		const t2 = performance.now();
		// it shouldn't wait for the delay in the inner context
		expect(teardownCalled).toBe(false);
		expect(t2 - t1).toBeLessThan(10);
		await native.waitUntilSettled();
		expect(events).toEqual(["lvl 2 teardown", "lvl 1 teardown"]);
	});
}
