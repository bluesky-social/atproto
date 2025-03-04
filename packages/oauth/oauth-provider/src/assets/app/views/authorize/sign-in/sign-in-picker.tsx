import { Trans, useLingui } from '@lingui/react/macro'
import { Account } from '../../../backend-types.ts'
import { Button } from '../../../components/forms/button.tsx'
import {
  FormCard,
  FormCardProps,
} from '../../../components/forms/form-card.tsx'
import { InputContainer } from '../../../components/forms/input-container.tsx'
import { AccountImage } from '../../../components/utils/account-image.tsx'
import {
  AtSymbolIcon,
  CaretRightIcon,
} from '../../../components/utils/icons.tsx'
import { Override } from '../../../lib/util.ts'

export type SignInPickerProps = Override<
  Omit<FormCardProps, 'cancel' | 'actions' | 'append'>,
  {
    accounts: readonly Account[]

    onAccount: (account: Account) => void
    onOther?: () => void
    onBack?: () => void
  }
>

export function SignInPicker({
  accounts,

  onAccount,
  onOther = undefined,
  onBack,

  // FormCard
  children,
  ...props
}: SignInPickerProps) {
  const { t } = useLingui()
  return (
    <FormCard
      {...props}
      append={children}
      actions={null}
      cancel={
        onBack && (
          <Button onClick={onBack}>
            <Trans>Back</Trans>
          </Button>
        )
      }
    >
      <p className="text-slate-600 dark:text-slate-400 text-sm font-medium">
        <Trans>Sign in as...</Trans>
      </p>

      {accounts.map((account) => {
        const [name, identifier] = [
          account.name,
          account.preferred_username,
          account.email,
          account.sub,
        ].filter(Boolean) as [string, string?]

        return (
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
            icon={<AccountImage src={account.picture} alt={name} />}
            append={<CaretRightIcon aria-hidden className="h-4" />}
          >
            <span className="flex flex-wrap items-center">
              <span className="font-medium truncate mr-2" arial-label={t`Name`}>
                {name}
              </span>
              {identifier && (
                <span
                  className="text-sm text-neutral-500 dark:text-neutral-400 truncate"
                  arial-label={t`Identifier`}
                >
                  {identifier}
                </span>
              )}
            </span>
          </InputContainer>
        )
      })}

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
          append={<CaretRightIcon aria-hidden className="h-4" />}
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
