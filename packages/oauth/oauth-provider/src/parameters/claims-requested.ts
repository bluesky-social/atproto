import {
  OAuthAuthenticationRequestParameters,
  OidcClaimsParameter,
  OidcEntityType,
} from '@atproto/oauth-types'
import { InvalidRequestError } from '../errors/invalid-request-error.js'

export function claimRequested(
  parameters: OAuthAuthenticationRequestParameters,
  entityType: OidcEntityType,
  claimName: OidcClaimsParameter,
  value: unknown,
): boolean {
  if (claimAvailable(parameters, entityType, claimName, value)) {
    return true
  }

  const entityClaims = parameters.claims?.[entityType]
  if (entityClaims?.[claimName]?.essential === true) {
    // https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.5.5.1
    //
    // > By requesting Claims as Essential Claims, the RP indicates to the
    // > End-User that releasing these Claims will ensure a smooth
    // > authorization for the specific task requested by the End-User. Note
    // > that even if the Claims are not available because the End-User did
    // > not authorize their release or they are not present, the
    // > Authorization Server MUST NOT generate an error when Claims are not
    // > returned, whether they are Essential or Voluntary, unless otherwise
    // > specified in the description of the specific claim.
    switch (claimName) {
      case 'acr':
        // https://openid.net/specs/openid-connect-core-1_0.html#rfc.section.5.5.1.1
        //
        // > If this is an Essential Claim and the requirement cannot be met,
        // > then the Authorization Server MUST treat that outcome as a failed
        // > authentication attempt.
        throw new InvalidRequestError(
          `Unable to provide essential claim: ${claimName}`,
        )
    }
  }

  return false
}

function claimAvailable(
  parameters: OAuthAuthenticationRequestParameters,
  entityType: OidcEntityType,
  claimName: OidcClaimsParameter,
  value: unknown,
): boolean {
  if (value === undefined) return false

  if (parameters.claims) {
    const entityClaims = parameters.claims[entityType]
    if (entityClaims === undefined) return false

    const claimConfig = entityClaims[claimName]
    if (claimConfig === undefined) return false
    if (claimConfig === null) return true

    if (
      claimConfig.value !== undefined &&
      !compareClaimValue(claimConfig.value, value)
    ) {
      return false
    }

    if (
      claimConfig?.values !== undefined &&
      !claimConfig.values.some((v) => compareClaimValue(v, value))
    ) {
      return false
    }
  }

  return true
}

type DefinedValue = NonNullable<unknown> | null

function compareClaimValue(
  expectedValue: DefinedValue,
  value: DefinedValue,
): boolean {
  const expectedType = typeof expectedValue
  const valueType = typeof value

  if (expectedType !== valueType) return false

  switch (typeof expectedValue) {
    case 'undefined':
    case 'string':
    case 'number':
    case 'boolean':
      return expectedValue === value
    case 'object':
      if (expectedValue === null) return value === null
    // @TODO (?): allow object comparison
    // falls through
    default:
      throw new InvalidRequestError(
        `Unable to compare claim value of type ${expectedType}`,
      )
  }
}
