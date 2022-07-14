export type Message = Join | ChannelMessage

export type Join = {
  type: 'join'
  channel: string
}

export type ChannelMessage = {
  type: 'message'
  channel: string
  message: any
}
