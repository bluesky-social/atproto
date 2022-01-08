import { Request } from "express"
import * as ucan from "ucans"
import { Ucan } from "ucans"


type Check = (ucan: Ucan) => Error | null

export const checkUcan = async (req: Request, ...checks: Check[]): Promise<Ucan> => {
  const header = req.headers.authorization
  if (!header) {
    throw new Error("No Ucan found in message headers")
  }

  const stripped = header.replace('Bearer ', '')
  const decoded = ucan.decode(stripped)

  const isValid = await ucan.isValid(decoded)
  if (!isValid) {
    throw new Error("Invalid Ucan")
  }

  for(let i=0; i<checks.length; i++) {
    const maybeErr = checks[i](decoded)
    if (maybeErr !== null) {
      throw maybeErr
    }
  }

  return decoded
}

export const hasAudience = (did: string) => (token: Ucan): Error | null => {
  if(token.payload.aud !== did) {
    return new Error("Ucan audience does not match server Did")
  }
  return null
}

// @@TODO: Fix this, since it is changing with the new ucan api
export const hasRootDid = (did: string) => (token: Ucan): Error | null => {
  return null
}

export const hasPostingPermission = (username: string) => (token: Ucan): Error | null => {
  const capabilities = token.payload.att
  const hasPerm = capabilities.some((cap) => 
    cap['twitter'] === username && cap.cap === 'POST'
  )
  if (!hasPerm) {
    return new Error(`Ucan does not permission the ability to post for user: ${username}`)
  }
  return null
}


