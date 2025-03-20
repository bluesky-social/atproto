import React from 'react'
import { Popover } from 'radix-ui'
import { useLingui } from '@lingui/react'
import { msg } from '@lingui/core/macro'
// import { XMarkIcon } from '@heroicons/react/24/solid'
import { clsx } from 'clsx'

const accounts = [
  {
    handle: '@esb.lol',
    did: 'did:plc:3jpt2mvvsumj2r7eqk4gzzjz',
    avatar:
      'https://cdn.bsky.app/img/avatar/plain/did:plc:3jpt2mvvsumj2r7eqk4gzzjz/bafkreiaexnb3bkzbaxktm5q3l3txyweflh3smcruigesvroqjrqxec4zv4@jpeg',
  },
  {
    handle: '@test.esb.lol',
    did: 'did:plc:3jpt2mvvsumj2r7eqk4gzzjz',
    avatar:
      'https://cdn.bsky.app/img/avatar/plain/did:plc:dpajgwmnecpdyjyqzjzm6bnb/bafkreia6dx7fhoi6fxwfpgm7jrxijpqci7ap53wpilkpazojwvqlmgud2m@jpeg',
  },
]

export function AccountSelector() {
  const { _ } = useLingui()

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          className="w-12 h-12 rounded-full overflow-hidden border-2 border-contrast-200 hover:border-contrast-300"
          aria-label={_(msg`Select an account`)}
        >
          <img src="https://cdn.bsky.app/img/avatar/plain/did:plc:3jpt2mvvsumj2r7eqk4gzzjz/bafkreiaexnb3bkzbaxktm5q3l3txyweflh3smcruigesvroqjrqxec4zv4@jpeg" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side="top"
          align="end"
          className="PopoverContent w-full"
          sideOffset={5}
          style={{ width: 320 }}
        >
          <div className="relative bg-contrast-50 rounded-lg overflow-hidden shadow-xl shadow-contrast-0">
            <div className="flex flex-col">
              {accounts.map((account, i) => (
                <button
                  key={account.did}
                  className={clsx([
                    'flex items-center space-x-3 p-3 pr-4',
                    'hover:bg-contrast-100',
                    i !== 0 && 'border-t border-contrast-100',
                  ])}
                >
                  <img src={account.avatar} className="w-9 h-9 rounded-full" />
                  <div className="text-left truncate">
                    <p className="text-sm font-bold text-text-default">
                      {account.handle}
                    </p>
                    <p className="text-sm text-text-light truncate">
                      {account.did}
                    </p>
                  </div>
                </button>
              ))}
            </div>

            {/*
            <Popover.Close
              className="PopoverClose w-5 h-5 absolute top-2 right-2 text-text-light"
              aria-label="Close"
            >
              <XMarkIcon />
            </Popover.Close>
            */}
          </div>

          <Popover.Arrow className="PopoverArrow text-contrast-50" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
