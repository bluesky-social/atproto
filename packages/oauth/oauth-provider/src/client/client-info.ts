export type ClientInfo = {
  /**
   * Defaults to `false`
   */
  isFirstParty: boolean

  /**
   * Defaults to `true` if the client is isFirstParty, or if the client was
   * loaded from the store. (i.e. false in case of "loopback" & "discoverable"
   * clients)
   */
  isTrusted: boolean
}
