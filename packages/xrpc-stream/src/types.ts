enum FrameType {
  Message = 1,
  Info = 2,
  Error = -1,
}

export type MessageFrameHeader = {
  t: FrameType.Message // Frame type
  id?: string // Mesage id for resumption
  k?: string // Message body kind discriminator
}

export type InfoFrameHeader = {
  t: FrameType.Info
  k?: string // Info body kind discriminator
}

// No body, must disconnect
export type ErrorFrameHeader = {
  t: FrameType.Error
  err?: string // Error code
  msg?: string // Error message
}
