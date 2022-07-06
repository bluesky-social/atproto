export type AwakeMessage =
  | Request
  | ProvisionAnnounce
  | ChannelDid
  | NegotiateSession
  | SharePin
  | DelegateCred
  | Terminate

export type Request = {
  type: 'Awake_Request'
}

export const request = (): Request => {
  return { type: 'Awake_Request' }
}

export type ProvisionAnnounce = {
  type: 'Awake_Provision_Announce'
}

export const provisionAnnounce = (): ProvisionAnnounce => {
  return { type: 'Awake_Provision_Announce' }
}

export type ChannelDid = {
  type: 'Awake_Channel_Did'
  channel_did: string
}

export const channelDid = (channel_did: string): ChannelDid => {
  return { type: 'Awake_Channel_Did', channel_did }
}

export type NegotiateSession = {
  type: 'Awake_Negotiate_Session'
  prov_did: string
  ucan: string
}

export const negotiateSession = (
  prov_did: string,
  ucan: string,
): NegotiateSession => {
  return { type: 'Awake_Negotiate_Session', prov_did, ucan }
}

export type SharePin = {
  type: 'Awake_Share_Pin'
  pin: string
  did: string
}

export const sharePin = (pin: string, did: string): SharePin => {
  return { type: 'Awake_Share_Pin', pin, did }
}

export type DelegateCred = {
  type: 'Awake_Delegate_Cred'
  ucan: string
}

export const delegateCred = (ucan: string): DelegateCred => {
  return { type: 'Awake_Delegate_Cred', ucan }
}

export type Terminate = {
  type: 'Awake_Terminate'
  error: string
}

export const terminate = (error: string): Terminate => {
  return { type: 'Awake_Terminate', error }
}
