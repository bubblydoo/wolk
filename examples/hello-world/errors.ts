import { WolkError } from "../../src/errors/error";

export class TrackingError extends WolkError.extend({
	name: "TrackingError",
}) {}

export class CantCreateTrackingTrackingError extends TrackingError.extend({
	name: "CantCreateTrackingTrackingError",
}) {}

export class InvalidCourierTrackingError extends TrackingError.extend({
	name: "InvalidCourierTrackingError",
}) {}

export class InvalidCodeTrackingError extends TrackingError.extend({
	name: "InvalidCodeTrackingError",
}) {}

export class ApiErrorTrackingError extends TrackingError.extend({
	name: "ApiErrorTrackingError",
}) {}

export class UnknownTrackingError extends TrackingError.extend({
	name: "UnknownTrackingError",
}) {}