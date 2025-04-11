import { useMutation } from '@tanstack/react-query'
import { ConfirmResetPasswordInput, useApi } from '#/api'

export type PasswordConfirmMutationInput = ConfirmResetPasswordInput

export function usePasswordConfirmMutation() {
  const api = useApi()

  return useMutation({
    async mutationFn(input: ConfirmResetPasswordInput) {
      await api.fetch('POST', '/reset-password-confirm', input)
    },
  })
}
