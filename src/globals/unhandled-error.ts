import { EventBus } from "../util/event-bus";
import { triggerUnhandledRejection } from "../util/trigger-unhandled-rejection";

let globalUnhandledErrorEventBus: EventBus<unknown> | undefined;

export function reportUnhandledError(error: unknown) {
	globalUnhandledErrorEventBus ??= new EventBus();
	globalUnhandledErrorEventBus.emit(error);
	if (!globalUnhandledErrorEventBus.hasListeners()) {
		console.error("Unhandled Wolk error:", error);
		triggerUnhandledRejection(error);
	}
}

export function onUnhandledError(cb: (error: unknown) => void) {
	globalUnhandledErrorEventBus ??= new EventBus();
	return globalUnhandledErrorEventBus.listen(cb);
}
