import { Trans, useLingui } from '@lingui/react/macro'
import { ReactNode } from 'react'
import type { Account } from '@atproto/oauth-provider-api'
import { Button } from '../../../components/forms/button.tsx'
import {
  FormCard,
  FormCardProps,
} from '../../../components/forms/form-card.tsx'
import { InputContainer } from '../../../components/forms/input-container.tsx'
import { AccountImage } from '../../../components/utils/account-image.tsx'
import {
  AtSymbolIcon,
  ChevronRightIcon,
} from '../../../components/utils/icons.tsx'
import { Override } from '../../../lib/util.ts'

export type SignInPickerProps = Override<
  Omit<FormCardProps, 'cancel' | 'actions' | 'append'>,
  {
    accounts: readonly Account[]

    onAccount: (account: Account) => void
    onOther?: () => void
    onBack?: () => void
    onSignUp?: () => void

    backLabel?: ReactNode
  }
>

export function SignInPicker({
  accounts,

  onAccount,
  onOther = undefined,
  onBack,
  onSignUp,

  backLabel,

  // FormCard
  children,
  ...props
}: SignInPickerProps) {
  const { t } = useLingui()
  return (
    <FormCard
      {...props}
      append={children}
      actions={
        onSignUp && (
          <Button onClick={onSignUp} color="primary" transparent>
            <Trans>Sign up</Trans>
          </Button>
        )
      }
      cancel={
        onBack && (
          <Button onClick={onBack}>{backLabel || <Trans>Back</Trans>}</Button>
        )
      }
    >
      <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
        <Trans>Sign in as...</Trans>
      </p>

      {accounts.map((account) => (
        <InputContainer
          tabIndex={0}
          key={account.sub}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              onAccount(account)
            }
          }}
          onClick={() => onAccount(account)}
          role="button"
          aria-label={t`Sign in as ${account.name}`}
          icon={<AccountImage src={account.picture} alt={t`Avatar`} />}
          append={<ChevronRightIcon aria-hidden className="h-4" />}
        >
          <span className="flex flex-wrap items-center">
            {account.name && (
              <span className="mr-2 truncate font-medium" arial-label={t`Name`}>
                {account.name}
              </span>
            )}

            <span
              className="truncate text-sm text-neutral-500 dark:text-neutral-400"
              arial-label={t`Identifier`}
            >
              {account.preferred_username || account.email || account.sub}
            </span>
          </span>
        </InputContainer>
      ))}

      {onOther && (
        <InputContainer
          key="other"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') onOther()
          }}
          onClick={onOther}
          aria-label={t`Login to account that is not listed`}
          role="button"
          append={<ChevronRightIcon aria-hidden className="h-4" />}
          icon={<AtSymbolIcon aria-hidden className="h-4" />}
        >
          <span className="truncate text-slate-700 dark:text-slate-400">
            <Trans>Another account</Trans>
          </span>
        </InputContainer>
      )}
    </FormCard>
  )
}
