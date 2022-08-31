//@TODO should badge refs be nested in that manner & should they be optional?
export interface Record {
  displayName: string
  description?: string
  badges?: BadgeRef[]
}
export interface BadgeRef {
  uri: string
}
