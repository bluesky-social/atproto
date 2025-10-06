import { ServerEnvironment } from './env'

export const envToSecrets = (env: ServerEnvironment): ServerSecrets => {
  let plcRotationKey: ServerSecrets['plcRotationKey']
  if (env.plcRotationKeyKmsKeyId && env.plcRotationKeyK256PrivateKeyHex) {
    throw new Error('Cannot set both kms & memory keys for plc rotation key')
  } else if (env.plcRotationKeyKmsKeyId) {
    plcRotationKey = {
      provider: 'kms',
      keyId: env.plcRotationKeyKmsKeyId,
    }
  } else if (env.plcRotationKeyK256PrivateKeyHex) {
    plcRotationKey = {
      provider: 'memory',
      privateKeyHex: env.plcRotationKeyK256PrivateKeyHex,
    }
  } else {
    throw new Error('Must configure plc rotation key')
  }

  let jwtSecret: ServerSecrets['jwtSecret']
  if (env.jwtSecret && env.jwtSigningKeyK256PrivateKeyHex) {
    throw new Error('Cannot set both JWT secret & JWT private key')
  } else if (env.jwtSigningKeyK256PrivateKeyHex) {
    jwtSecret = {
      type: 'private',
      privateKeyHex: env.jwtSigningKeyK256PrivateKeyHex,
    }
  } else if (env.jwtSecret) {
    jwtSecret = {
      type: 'secret',
      secret: env.jwtSecret,
    }
  } else {
    throw new Error('Must provide a JWT secret')
  }

  if (!env.adminPassword) {
    throw new Error('Must provide an admin password')
  }

  return {
    dpopSecret: env.dpopSecret,
    jwtSecret: jwtSecret,
    adminPassword: env.adminPassword,
    plcRotationKey,
    entrywayAdminToken: env.entrywayAdminToken ?? env.adminPassword,
  }
}

export type ServerSecrets = {
  dpopSecret?: string
  jwtSecret: JwtSecretKey | JwtPrivateKey
  adminPassword: string
  plcRotationKey: SigningKeyKms | SigningKeyMemory
  entrywayAdminToken?: string
}

export type SigningKeyKms = {
  provider: 'kms'
  keyId: string
}

export type SigningKeyMemory = {
  provider: 'memory'
  privateKeyHex: string
}

export type JwtSecretKey = {
  type: 'secret'
  secret: string
}

export type JwtPrivateKey = {
  type: 'private'
  privateKeyHex: string
}
