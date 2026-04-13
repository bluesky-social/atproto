import { abortableSleep } from './sleep.js'

/**
 * Performs polling based backpressure management for a WebSocket connection. If
 * the amount of buffered data exceeds the specified high water mark, this
 * function will wait until the buffered amount drops below the low water mark
 * before resolving. This is useful for preventing memory issues when sending
 * large amounts of data over a WebSocket connection.
 */
export async function drainWebsocket(
  socket: WebSocket,
  signal: AbortSignal,
  {
    highWaterMark = 250_000, // 250 KB
    lowWaterMark = 50_000, // 50 KB
  }: {
    highWaterMark?: number
    lowWaterMark?: number
  } = {},
): Promise<void> {
  if (socket.bufferedAmount > highWaterMark) {
    // Once we exceed the high water mark, we wait until the buffered amount
    // drops below the low water mark before allowing more data to be sent. This
    // creates a hysteresis effect that prevents rapid toggling around the
    // threshold.
    while (
      socket.readyState === 1 &&
      socket.bufferedAmount !== 0 &&
      socket.bufferedAmount > lowWaterMark
    ) {
      await abortableSleep(10, signal)
    }
  }
}
