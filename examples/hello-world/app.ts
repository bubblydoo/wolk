import type { WaitUntilFn } from "../../src/contexts/wait-until";
import { env, wrap } from "./contexts";
import type { Env } from "./env";

export default {
	async fetch(
		req: Request,
		env: Env,
		ctx: {
			waitUntil: WaitUntilFn;
		},
	) {
		return wrap({ env, waitUntil: ctx.waitUntil }, () => route(req));
	},
};

async function route(req: Request) {
	return new Response(`Hello, ${env.get("SECRET")}!`);
}
