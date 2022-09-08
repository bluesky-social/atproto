export interface Record {
  displayName: string;
  description?: string;
  badges?: BadgeRef[];
}
export interface BadgeRef {
  uri: string;
}
