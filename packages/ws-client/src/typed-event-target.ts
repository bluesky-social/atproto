/**
 * EventTarget with a typed event map. The runtime behavior is the native
 * EventTarget; the `declare` overrides only refine the types so
 * `addEventListener('open', ev => ...)` infers the right event/detail.
 */
export class TypedEventTarget<
  EventMap extends Record<string, Event>,
> extends EventTarget {
  // Declared as an intersection with the base `EventTarget` method type so
  // the override is structurally assignable to it (one member of the
  // intersection is that exact base type) while the other member narrows
  // `type`/`listener` for typed call sites.
  //
  // Known limitation, identical to the TS DOM lib's own typed EventTargets
  // (`WebSocket`, `EventSource`, …): an event name NOT in `EventMap` still
  // compiles by falling through to the base `(type: string, …)` overload
  // (with `ev` widened to `Event`), so a typo'd name isn't a type error. This
  // is inherent to keeping `extends EventTarget`; valid keys narrow correctly.
  declare addEventListener: (<K extends keyof EventMap & string>(
    type: K,
    listener: (ev: EventMap[K]) => void,
    options?: boolean | AddEventListenerOptions,
  ) => void) &
    EventTarget['addEventListener']

  declare removeEventListener: (<K extends keyof EventMap & string>(
    type: K,
    listener: (ev: EventMap[K]) => void,
    options?: boolean | EventListenerOptions,
  ) => void) &
    EventTarget['removeEventListener']
}

export interface CloseEventDetail {
  code: number
  reason: string
  wasClean: boolean
}

export type WebSocketConnectionEventMap = {
  open: Event
  error: CustomEvent<{ error: unknown }>
  close: CustomEvent<CloseEventDetail>
}

export type WebSocketClientEventMap = {
  open: Event
  reconnect: Event
  error: CustomEvent<{ error: unknown; reconnect?: { attempt: number } }>
  close: CustomEvent<CloseEventDetail>
}
