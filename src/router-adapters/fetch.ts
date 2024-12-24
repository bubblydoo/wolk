import { expect, it } from "vitest";
import type { ReportFn } from "../contexts/report";
import { isWolkError, WolkError } from "../errors/error";

export function errorToResponse(error: unknown, report: ReportFn): Response {
	if (isWolkError(error)) {
		// if (error.report) {
		//   report(error);
		// }
		return new Response(
			JSON.stringify(
				{
          type: error.type,
          message: error.message,
          info: error.publicInfo,
        },
			),
			{
				status: error.httpStatus,
				headers: { "Content-Type": "application/json" },
			},
		);
	}
	return new Response(
		JSON.stringify({
			type: "InternalError",
			message: "Internal error",
		}),
		{
			status: 500,
			headers: { "Content-Type": "application/json" },
		},
	);
}

if (import.meta.vitest) {
	it("handles random errors", async () => {
		const error = new Error("test");
		const response = errorToResponse(error, () => {});
		expect(response.status).toBe(500);
		expect(response.headers.get("Content-Type")).toBe("application/json");
		expect(await response.json()).toMatchObject({ type: "InternalError" });
	});

  it("handles WolkErrors with non-public info", async () => {
    const error = new WolkError({ info: { secret: "keyboardcat" } });
    const response = errorToResponse(error, () => {});
    expect(response.status).toBe(500);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(await response.json()).toEqual({ message: "WolkError", type: "WolkError" });
  });

  it("handles WolkErrors with public info", async () => {
    class PublicError extends WolkError.extend({
      name: "PublicError",
      infoIsPublic: true,
    }) {}

    const error = new PublicError({
      info: { wolkAttribute: "great" },
    });
    const response = errorToResponse(error, () => {});
    expect(response.status).toBe(500);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(await response.json()).toEqual({ message: "PublicError", type: "PublicError", info: { wolkAttribute: "great" } });
  });
}
