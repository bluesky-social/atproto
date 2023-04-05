import * as crypto from '@atproto/crypto'
import { ServerConfig } from '../../../../config'

// generate a 7 char b32 invite code - preceded by the hostname
// with '.'s replaced by '-'s so it is not mistakable for a link
// ex: bsky-app-abc2345
// regex: bsky-app-[a-z2-7]{7}
export const genInvCode = (cfg: ServerConfig): string => {
  const code = crypto.randomStr(7, 'base32').slice(0, 7)
  return cfg.publicHostname.replaceAll('.', '-') + '-' + code
}

export const genInvCodes = (cfg: ServerConfig, count: number): string[] => {
  const codes: string[] = []
  for (let i = 0; i < count; i++) {
    codes.push(genInvCode(cfg))
  }
  return codes
}
