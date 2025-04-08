import { useMutation } from '@tanstack/react-query'
import { SignInInput, useApi } from '#/api'
import { useUpsertDeviceAccount } from '#/data/useDeviceSessionsQuery'
import { useLocale } from '#/locales'

export type SignInMutationInput = Omit<SignInInput, 'locale'>

export function useSignInMutation() {
  const api = useApi()
  const { locale } = useLocale()

  const upsertDeviceAccount = useUpsertDeviceAccount()

  return useMutation({
    async mutationFn(input: SignInMutationInput) {
      const res = await api.fetch('POST', '/sign-in', { ...input, locale })

      upsertDeviceAccount({
        account: res.account,
        loginRequired: false,
      })

      return res
    },
  })
}
