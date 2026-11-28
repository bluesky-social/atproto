// @NOTE Node < 24 has no AsyncDisposableStack. This installs nothing when the
// runtime provides it.
import 'core-js/es/async-disposable-stack/index.js'

/**
 * Owns the resources a fixture's `create()` acquires until setup succeeds.
 *
 * Register each resource right after acquiring it and call `move()` once
 * setup is done. If setup throws first, `await using` disposes what was
 * registered, most recent first. Errors thrown while disposing are dropped, so
 * the caller gets the setup error itself rather than a `SuppressedError`.
 *
 * @example
 * await using stack = new SetupStack()
 * const plc = stack.use(await TestPlc.create({}))
 * const pds = stack.use(await TestPds.create({ didPlcUrl: plc.url }))
 * stack.move()
 * return new TestNetworkNoAppView(plc, pds)
 */
export class SetupStack extends AsyncDisposableStack {
  override async [Symbol.asyncDispose](): Promise<void> {
    try {
      await this.disposeAsync()
    } catch {
      // @NOTE dropped, so that the setup error is the one rethrown
    }
  }
}
