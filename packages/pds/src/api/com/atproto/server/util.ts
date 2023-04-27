import * as crypto from '@atproto/crypto'
import { ServerConfig } from '../../../../config'

// generate a 9-char b32 invite code - preceded by the hostname
// with '.'s replaced by '-'s so it is not mistakable for a link
// ex: bsky-app-abc234567
// regex: bsky-app-[a-z2-7]{9}
export const genInvCode = (cfg: ServerConfig): string => {
  const code = crypto.randomStr(8, 'base32').slice(0, 9)
  return cfg.publicHostname.replaceAll('.', '-') + '-' + code
}

export const genInvCodes = (cfg: ServerConfig, count: number): string[] => {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    codes.push(genInvCode(cfg))
  }
  return codes
}
