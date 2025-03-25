import { useMutation } from '@tanstack/react-query'

import { useApi } from '#/api'
import { useLocale } from '#/locales'

export function useSignInMutation() {
  const api = useApi()
  const { locale } = useLocale()

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
