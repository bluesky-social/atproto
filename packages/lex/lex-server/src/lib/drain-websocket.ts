import { abortableSleep } from './sleep.js'

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
    while (
      socket.readyState === 1 &&
      socket.bufferedAmount !== 0 &&
      socket.bufferedAmount > lowWaterMark
    ) {
      await abortableSleep(10, signal)
    }
  }
}
