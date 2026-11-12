/** Calls handlers in order, skipping the second if the event is default prevented. */
export function composeEventHandlers<E extends { defaultPrevented: boolean }>(
  firstHandler: ((event: E) => void) | undefined,
  secondHandler: ((event: E) => void) | undefined,
): (event: E) => void {
  return (event) => {
    firstHandler?.(event)
    if (!event.defaultPrevented) secondHandler?.(event)
  }
}
