/**
* GENERATED CODE - DO NOT MODIFY
*/
export interface Record {
  originator: Originator;
  assertion: Assertion;
  createdAt: string;
  [k: string]: unknown;
}

export interface Originator {
  did: string;
  declarationCid: string;
  [k: string]: unknown;
}

export interface Assertion {
  uri: string;
  cid: string;
  [k: string]: unknown;
}
