/**
 * Invoke a user-supplied lifecycle hook from inside a state transition.
 *
 * - `this` is pinned to `null` so the hook can't reach internal state (the
 *   natural receiver at most call sites would be a private options object).
 * - A throwing hook must not corrupt the state machine mid-transition, so the
 *   error is re-thrown on a microtask — surfacing as an uncaught exception
 *   (crash-visible) without unwinding through connection/client internals.
 *   Hooks are expected not to throw.
 */
export function invokeHook<A extends unknown[]>(
  hook: ((...args: A) => void) | undefined,
  ...args: A
): void {
  if (!hook) return
  try {
    hook.call(null, ...args)
  } catch (err) {
    queueMicrotask(() => {
      throw err
    })
  }
}
