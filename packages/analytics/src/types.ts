export interface AccountCreatedEvt {
  did: string
  handle: string
  email: string
  createdAt: string
  inviteCode?: string
}

export interface Analytics {
  accountCreated: (props: AccountCreatedEvt) => Promise<void>
  close: () => Promise<void>
}
