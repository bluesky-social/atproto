import { Messages } from '@lingui/core'

// @NOTE run "pnpm run po:compile" to compile the messages from the PO files

export async function loadMessages(locale: string): Promise<Messages> {
  const { messages } = await import(`./${locale}/messages.ts`)
  return messages
}
