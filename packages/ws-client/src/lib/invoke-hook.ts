/**
 * Invoke a user-supplied lifecycle hook.
 *
 * - `this` is pinned to `null` so the hook can't reach internal state.
 * - A throwing hook must not unwind through our own internals mid-transition, so
 *   the error is re-thrown on a microtask instead: still crash-visible as an
 *   uncaught exception. Hooks are expected not to throw.
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
