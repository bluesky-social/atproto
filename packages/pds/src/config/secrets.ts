import type { ServerEnvironment } from './env.js'

export const envToSecrets = (env: ServerEnvironment): ServerSecrets => {
  if (!env.jwtSecret) {
    throw new Error('Must provide a JWT secret')
  }

  if (!env.adminPassword) {
    throw new Error('Must provide an admin password')
  }

  return {
    dpopSecret: env.dpopSecret,
    jwtSecret: env.jwtSecret,
    adminPassword: env.adminPassword,
    plcRotationKey: envToPlcRotationKeyConfig(env),
    entrywayAdminToken: env.entrywayAdminToken ?? env.adminPassword,
  }
}

export type ServerSecrets = {
  dpopSecret?: string
  jwtSecret: string
  adminPassword: string
  plcRotationKey?: PlcRotationKeyConfig
  entrywayAdminToken?: string
}

export type PlcRotationKeyConfig = SigningKeyKms | SigningKeyMemory

export type SigningKeyKms = {
  provider: 'kms'
  keyId: string
}

export type SigningKeyMemory = {
  provider: 'memory'
  privateKeyHex: string
}
/**
 * Converts environment variables to a PLC rotation key.
 *
 * @note We allow "undefined" values here so that if an override is provided to
 * the AppContext, a private key does not need to be provided here.
 */
function envToPlcRotationKeyConfig(
  env: ServerEnvironment,
): PlcRotationKeyConfig | undefined {
  if (env.plcRotationKeyKmsKeyId && env.plcRotationKeyK256PrivateKeyHex) {
    throw new Error('Cannot set both kms & memory keys for plc rotation key')
  } else if (env.plcRotationKeyKmsKeyId) {
    return {
      provider: 'kms',
      keyId: env.plcRotationKeyKmsKeyId,
    }
  } else if (env.plcRotationKeyK256PrivateKeyHex) {
    return {
      provider: 'memory',
      privateKeyHex: env.plcRotationKeyK256PrivateKeyHex,
    }
  } else {
    return undefined
  }
}
