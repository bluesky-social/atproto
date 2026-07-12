// WebSocketKeepAlive is Node-only: its reconnect loop depends on the `ws`
// package, which never enters the browser bundle. This stub keeps the browser
// entrypoint's export surface identical to Node's while failing loudly if used.
export class WebSocketKeepAlive {
  constructor() {
    throw new Error(
      'WebSocketKeepAlive is not available in the browser build; use WebSocketCore directly',
    )
  }
}

export { CloseCode, DisconnectError } from './keepalive-shared.js'
