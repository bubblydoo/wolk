import { expect, it } from "vitest";

export type WolkErrorCreationOptions<TInfo> = {
	name: string;
	type?: string;
	httpStatus?: number;
	infoIsPublic?: boolean;
	report?: boolean;
	publicInfo?: unknown;
	createPublicInfo?: (info: TInfo) => unknown;
	// extend?: WolkErrorCreationOptionsExtend<TParentInfo>;
};

type WolkExtendableError<TInfo> = {
	creationOptions: WolkErrorCreationOptions<TInfo>;
};


type WolkErrorOptions<TInfo> = ({
	message?: string;
} & ErrorOptions) &
	(TInfo extends undefined ? { info?: undefined } : { info: TInfo });

export class BaseWolkError<TInfo> extends Error {
	type: string;
	httpStatus: number;
	info: TInfo | undefined;
	publicInfo: unknown;
	// report: boolean;

	constructor(
		{
			name,
			type,
			httpStatus,
			infoIsPublic,
			createPublicInfo,
			// extend,
			// report,
		}: WolkErrorCreationOptions<TInfo>,
		{ message, info, ...errorOptions }: WolkErrorOptions<TInfo>,
	) {
		super(message ?? name, errorOptions);

		this.type = type ?? "WolkError";
		this.httpStatus = httpStatus ?? 500;
		// this.report = report ?? true;

		this.info = info;
		if (createPublicInfo) {
			this.publicInfo = info ? createPublicInfo(info) : info;
		} else if (infoIsPublic) {
			this.publicInfo = info;
		} else {
			this.publicInfo = undefined;
		}
	}
}

export const defaultErrorCreationOptions: WolkErrorCreationOptions<unknown> = {
	name: "WolkError",
	type: "WolkError",
	httpStatus: 500,
	infoIsPublic: false,
	report: true,
};

export class WolkError<TInfo = undefined> extends BaseWolkError<TInfo> {
	constructor(errorOptions: WolkErrorOptions<TInfo>) {
		super(defaultErrorCreationOptions, errorOptions);
		this.name = "WolkError";
	}

	static extend<TChildInfo>(
		childCreationOptions: WolkErrorCreationOptions<TChildInfo>,
	) {
		const err = extendError(defaultErrorCreationOptions, {
			type: childCreationOptions.name,
			...childCreationOptions,
		});
		return err;
	}
}

function extendError<TParentInfo, TChildInfo>(
	parentCreationOptions: WolkErrorCreationOptions<TParentInfo>,
	childCreationOptions: WolkErrorCreationOptions<TChildInfo>,
) {
	const mergedCreationOptions: WolkErrorCreationOptions<
		TChildInfo & TParentInfo
	> = {
		...parentCreationOptions,
		...childCreationOptions,
	};
	return class AnonymousIntermediateWolkError extends BaseWolkError<
		TChildInfo & TParentInfo
	> {
		static creationOptions = mergedCreationOptions;

		constructor(errorOptions: WolkErrorOptions<TChildInfo & TParentInfo>) {
			super(mergedCreationOptions, errorOptions);
			this.name = childCreationOptions.name;
		}

		static extend = createWolkErrorExtendFunction(
			AnonymousIntermediateWolkError,
		);
	};
}

function createWolkErrorExtendFunction<TParentInfo>(
	parentErrorClass: WolkExtendableError<TParentInfo>,
) {
	return function createWolkError<TChildInfo>(
		childCreationOptions: WolkErrorCreationOptions<TChildInfo>,
	) {
		return extendError(parentErrorClass.creationOptions, childCreationOptions);
	};
}

export function isError(value: unknown): value is Error {
	return (
		typeof value === "object" &&
		value !== null &&
		"name" in value &&
		"message" in value
	);
}

export function isWolkError(value: unknown): value is BaseWolkError<unknown> {
	return isError(value) && 'info' in value;
}

if (import.meta.vitest) {
	it("takes the parent type as the type name", () => {
		class TrackingError extends WolkError.extend({
			name: "TrackingError",
		}) {}

		const error1 = new TrackingError({ info: {} });
		expect(error1.name).toBe("TrackingError");
		expect(error1.type).toBe("TrackingError");

		class ApiTrackingError extends TrackingError.extend({
			name: "ApiTrackingError",
		}) {}

		const error2 = new ApiTrackingError({ info: undefined });
		expect(error2.name).toBe("ApiTrackingError");
		expect(error2.type).toBe("TrackingError");
	});

	it("takes public info from info if infoIsPublic is true", () => {
		class TrackingError extends WolkError.extend({
			name: "TrackingError",
			infoIsPublic: true,
		}) {}

		const error = new TrackingError({ info: "public" });
		expect(error.publicInfo).toBe("public");
	});

	it("has undefined info when infoIsPublic is false and createPublicInfo is undefined", () => {
		class TrackingError extends WolkError.extend({
			name: "TrackingError",
		}) {}

		const error = new TrackingError({ info: "public" });
		expect(error.publicInfo).toBe(undefined);
	});

	it("takes public info from createPublicInfo", () => {
		class TrackingError extends WolkError.extend<string>({
			name: "TrackingError",
			createPublicInfo: (info) => info.split("").reverse().join(""),
		}) {}

		const error = new TrackingError({ info: "public" });
		expect(error.publicInfo).toEqual("cilbup");
	});

	it("gives createPublicInfo precedence over infoIsPublic", () => {
		class TrackingError extends WolkError.extend<string>({
			name: "TrackingError",
			infoIsPublic: true,
			createPublicInfo: (info) => info.split("").reverse().join(""),
		}) {}

		const error = new TrackingError({ info: "public" });
		expect(error.publicInfo).toEqual("cilbup");
	});

	it("extends status from parent", () => {
		class TrackingError extends WolkError.extend({
			name: "TrackingError",
			httpStatus: 422,
		}) {}

		class ApiTrackingError extends TrackingError.extend({
			name: "ApiTrackingError",
		}) {}

		const error = new ApiTrackingError({ info: {} });
		expect(error.httpStatus).toBe(422);
	});

	it("shouldn't accept incompatible info (types)", () => {
		class TrackingError extends WolkError.extend<{ body: string }>({
			name: "TrackingError",
		}) {}

		// @ts-expect-error
		const error = new TrackingError({});
		// @ts-expect-error
		const error2 = new TrackingError({ info: undefined });
		// should work
		const error3 = new TrackingError({ info: { body: "lalala" } });
	});

	it("extends info from parent", () => {
		class TrackingError extends WolkError.extend<{ body: string }>({
			name: "TrackingError",
		}) {}

		class ApiTrackingError extends TrackingError.extend<{ errorCode: number }>({
			name: "ApiTrackingError",
		}) {}

		const x: InferInfoFromError<typeof TrackingError> = {
			body: "x",
			// @ts-expect-error
			foo: "bar",
		};

		// @ts-expect-error
		const x2: InferInfoFromError<typeof ApiTrackingError> = {
			body: "x",
		};

		// @ts-expect-error
		const error0 = new ApiTrackingError({});

		const error1 = new ApiTrackingError({
			// @ts-expect-error
			info: undefined,
		});

		const error2 = new ApiTrackingError({
			// @ts-expect-error
			info: { body: "body" },
		});

		// should work
		const error3 = new ApiTrackingError({
			info: { body: "body", errorCode: 123 },
		});

		expect(() => {
			// @ts-expect-error
			const error4 = new ApiTrackingError();
		}).toThrow();
	});

	type InferInfoFromError<T> = T extends WolkExtendableError<infer U> ? U : never;
}

