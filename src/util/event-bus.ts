export class EventBus<T> {
  private listeners = new Set<(thing: T) => void>();

  listen(listener: (thing: T) => void) {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(thing: T) {
    for (const listener of this.listeners) {
      listener(thing);
    }
  }

  hasListeners() {
    return this.listeners.size > 0;
  }
}