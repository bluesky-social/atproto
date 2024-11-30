import type { ReactNode } from 'react'
import { Account } from '../backend-data'
import { Override } from '../lib/util'
import { Button } from './button'
import { FormCard, FormCardProps } from './form-card'
import { AtSymbolIcon } from './icons/at-symbol-icon'
import { CaretRightIcon } from './icons/caret-right-icon'
import { InputContainer } from './input-container'
import { Fieldset } from './fieldset'

export type AccountPickerProps = Override<
  FormCardProps,
  {
    accounts: readonly Account[]

    onAccount: (account: Account) => void
    accountAria?: (account: Account) => string

    onOther?: () => void
    otherLabel?: ReactNode
    otherAria?: string

    onBack?: () => void
    backLabel?: ReactNode
    backAria?: string
  }
>

export function AccountPicker({
  accounts,

  onAccount,
  accountAria = (a) => `Sign in as ${a.name}`,

  onOther = undefined,
  otherLabel = 'Another account',
  otherAria = 'Login to account that is not listed',

  onBack,
  backAria,
  backLabel = backAria,

  ...props
}: AccountPickerProps) {
  return (
    <FormCard
      {...props}
      cancel={
        onBack && (
          <Button onClick={onBack} aria-label={backAria}>
            {backLabel}
          </Button>
        )
      }
    >
      <Fieldset title="Sign in as...">
        {accounts.map((account) => {
          const [name, identifier] = [
            account.name,
            account.preferred_username,
            account.email,
            account.sub,
          ].filter(Boolean) as [string, string?]

          return (
            <InputContainer
              key={account.sub}
              onClick={() => onAccount(account)}
              role="button"
              aria-label={accountAria(account)}
              icon={
                account.picture ? (
                  <img
                    crossOrigin="anonymous"
                    src={account.picture}
                    alt={name}
                    className="-ml-1 w-6 h-6 rounded-full"
                  />
                ) : (
                  <svg
                    className="-ml-1 w-6 h-6"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="none"
                  >
                    <circle cx="12" cy="12" r="12" fill="#0070ff"></circle>
                    <circle cx="12" cy="9.5" r="3.5" fill="#fff"></circle>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="#fff"
                      d="M 12.058 22.784 C 9.422 22.784 7.007 21.836 5.137 20.262 C 5.667 17.988 8.534 16.25 11.99 16.25 C 15.494 16.25 18.391 18.036 18.864 20.357 C 17.01 21.874 14.64 22.784 12.058 22.784 Z"
                    ></path>
                  </svg>
                )
              }
              append={<CaretRightIcon className="h-4" />}
            >
              <span className="flex flex-wrap items-center">
                <span className="font-medium truncate mr-2">{name}</span>
                {identifier && (
                  <span className="text-sm text-neutral-500 dark:text-neutral-400 truncate">
                    {identifier}
                  </span>
                )}
              </span>
            </InputContainer>
          )
        })}

        {onOther && (
          <InputContainer
            onClick={onOther}
            aria-label={otherAria}
            role="button"
            append={<CaretRightIcon className="h-4" />}
            icon={<AtSymbolIcon className="h-4" />}
          >
            <span className="truncate text-gray-700 dark:text-gray-400">
              {otherLabel}
            </span>
          </InputContainer>
        )}
      </Fieldset>
    </FormCard>
  )
}
