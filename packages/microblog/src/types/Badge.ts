export interface Record {
  assertion: InviteAssertion | EmployeeAssertion | TagAssertion | UnknownAssertion;
  subject: string;
  createdAt: string;
}
export interface InviteAssertion {
  type: "invite";
}
export interface EmployeeAssertion {
  type: "employee";
}
export interface TagAssertion {
  type: "tag";
  tag: string;
}
export interface UnknownAssertion {
  type: string;
}
