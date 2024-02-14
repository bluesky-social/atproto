import { InvalidRequestError } from '../errors/invalid-request-error.js'
import {
  AuthorizationParameters,
  ClaimsEntityType,
  EntityClaims,
} from './authorization-parameters.js'

export function claimRequested(
  parameters: AuthorizationParameters,
  entityType: ClaimsEntityType,
  claimName: EntityClaims,
  available: boolean,
): boolean {
  if (parameters.claims) {
    const entityClaims = parameters.claims[entityType]
    if (entityClaims === undefined) return false

    const claimConfig = entityClaims[claimName]
    if (claimConfig === undefined) return false
    if (claimConfig === null) return available

    if (!available && claimConfig?.essential === true) {
      throw new InvalidRequestError(
        `Unable to provide requested claim: ${claimName}`,
      )
    }
  }

  return available
}
