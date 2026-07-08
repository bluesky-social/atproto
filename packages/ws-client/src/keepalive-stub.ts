// Temporary browser stub. WebSocketKeepAlive will be reimplemented on top of
// WebSocketCore in a follow-up; until then it is unavailable in the browser.
export class WebSocketKeepAlive {
  constructor() {
    throw new Error(
      'WebSocketKeepAlive is not yet available in the browser build; use WebSocketCore directly',
    )
  }
}

export { CloseCode, DisconnectError } from './keepalive-shared.js'
