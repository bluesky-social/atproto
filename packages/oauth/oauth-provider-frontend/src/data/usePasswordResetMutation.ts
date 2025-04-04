import { useMutation } from '@tanstack/react-query'
import { InitiatePasswordResetInput, useApi } from '#/api'
import { useLocale } from '#/locales'

export type PasswordResetMutationInput = Omit<
  InitiatePasswordResetInput,
  'locale'
>

export function usePasswordResetMutation() {
  const api = useApi()
  const { locale } = useLocale()

  return useMutation({
    async mutationFn(input: PasswordResetMutationInput) {
      await api.fetch('POST', '/reset-password-request', { ...input, locale })
    },
  })
}
