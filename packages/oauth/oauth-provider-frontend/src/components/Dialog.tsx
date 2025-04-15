import * as Dialog from '@radix-ui/react-dialog'
import { Cross2Icon } from '@radix-ui/react-icons'
import { clsx } from 'clsx'
import { AriaRole, ReactNode } from 'react'

export const Root = Dialog.Root
export const Trigger = Dialog.Trigger
export const Title = Dialog.Title
export const Description = Dialog.Description

export function Outer({ children }: { children: ReactNode }) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="DialogOverlay bg-contrast-900/30 dark:bg-contrast-0/60 fixed inset-0" />
      {children}
    </Dialog.Portal>
  )
}

export function Inner({
  children,
  role,
  className,
}: {
  children: ReactNode
  role?: AriaRole
  className?: string
}) {
  return (
    <Dialog.Content
      role={role}
      className={clsx([
        'DialogContent',
        'max-w-[600px] rounded-xl p-5 shadow-xl',
        'bg-contrast-0 dark:bg-contrast-25 shadow-contrast-975/15 dark:shadow-contrast-0/60',
        className,
      ])}
    >
      {children}
    </Dialog.Content>
  )
}

export function Close() {
  return (
    <Dialog.Close
      className={clsx([
        'absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full border transition-colors focus:outline-0',
        'bg-contrast-0 dark:bg-contrast-25 border-contrast-25 dark:border-contrast-50',
        'hover:bg-contrast-25 dark:hover:bg-contrast-50 hover:border-contrast-50 dark:hover:border-contrast-100',
      ])}
    >
      <Cross2Icon className="text-text-light hover:text-text-default focus:text-text-default" />
    </Dialog.Close>
  )
}
