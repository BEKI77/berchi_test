// In-process fan-out for "a ticket changed" signals.
//
// The events carry no ticket data on purpose. A listener that hears one simply
// refetches through the normal API, so every permission check still applies and
// this channel can never leak a ticket to someone who could not GET it.
//
// This works because the salon runs a single server process on the cashier PC.
// If the app is ever run as several instances behind a balancer, publish would
// only reach the listeners on its own instance -- move this onto Postgres
// LISTEN/NOTIFY at that point.

type Listener = () => void;

// Route bundles can each get their own copy of a module, so the listener set
// hangs off globalThis. Otherwise the route that publishes and the route that
// streams could end up talking to two different sets.
const globalKey = Symbol.for("berchi.orderEventListeners");
const store = globalThis as unknown as { [globalKey]?: Set<Listener> };
const listeners = (store[globalKey] ??= new Set<Listener>());

export function subscribeOrderChanges(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function publishOrderChange(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // A dead connection must not stop the others from being told.
    }
  }
}
