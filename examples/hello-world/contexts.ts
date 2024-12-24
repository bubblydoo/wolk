import { createEnvContext } from "../../src/contexts/env";
import { createReportContext, createReportFn } from "../../src/contexts/report";
import {
	createWaitUntilContext,
	type WaitUntilFn,
} from "../../src/contexts/wait-until";
import type { Env } from "./env";

export const [{ waitUntil, onTeardown }, provideWaitUntil] =
	createWaitUntilContext();

export const [env, provideEnv] = createEnvContext<Env>();

export const [report, provideReport] = createReportContext();

export function wrap<R>(
	{ env, waitUntil }: { env: Env; waitUntil: WaitUntilFn },
	fn: () => Promise<R>,
) {
	let wrapped: () => Promise<R> = fn;
	wrapped = provideEnv(env, wrapped);
	wrapped = provideWaitUntil(waitUntil, wrapped);
	wrapped = provideReport(createReportFn(waitUntil), wrapped);
	return wrapped;
}
