import { useLingui } from '@lingui/react'
import { msg } from '@lingui/core/macro'

import {
  customizationData,
  authorizationData,
  errorData,
} from '#/data/useHydrationData/initialize'

export function useHydrationData() {
  const { _ } = useLingui()
  let error = errorData

  if (customizationData === undefined) {
    error = {
      error: _(msg`PDS configuration error`),
      error_description: _(
        msg`The page is missing required customization data`,
      ),
    }
  }

  if (authorizationData === undefined) {
    error = {
      error: _(msg`PDS configuration error`),
      error_description: _(
        msg`The page is missing required authorization data`,
      ),
    }
  }

  return {
    customizationData,
    authorizationData,
    errorData: error,
  }
}
