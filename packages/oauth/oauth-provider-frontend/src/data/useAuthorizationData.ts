import { useLingui } from '@lingui/react'
import { msg } from '@lingui/core/macro'

import { useHydrationData } from '#/data/useHydrationData'

export function useAuthorizationData() {
  const { _ } = useLingui()
  const { authorizationData } = useHydrationData()

  if (!authorizationData) {
    throw new Error(_(msg`The page is missing required authorization data.`))
  }

  return authorizationData
}
