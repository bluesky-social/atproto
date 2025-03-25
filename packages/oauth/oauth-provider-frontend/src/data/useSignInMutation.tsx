import { useMutation } from '@tanstack/react-query'

import { useApi } from '#/api'
import { useLocale } from '#/locales'
import { useCurrentAccount } from '#/state/account'
import { useAuthorizationData } from '#/data/useAuthorizationData'

export function useSignInMutation() {
  const api = useApi()
  const { locale } = useLocale()
  const { setCurrentAccount } = useCurrentAccount()
  const { sessions } = useAuthorizationData()

  return useMutation({
    async mutationFn({
      username,
      password,
      code,
      remember,
    }: {
      username: string
      password: string
      code?: string
      remember?: boolean
    }) {
      // TODO dev only
      setCurrentAccount(sessions[0])
      return
      return await api.fetch('/sign-in', {
        username,
        password,
        emailOtp: code,
        remember,
        locale,
      })
    },
  })
}
