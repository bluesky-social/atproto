import { useLingui } from '@lingui/react'
import { msg } from '@lingui/core/macro'

import { useHydrationData } from '#/data/useHydrationData'

export function useCustomizationData() {
  const { _ } = useLingui()
  const { customizationData } = useHydrationData()

  if (!customizationData) {
    throw new Error(_(msg`The page is missing required customization data.`))
  }

  return customizationData
}
