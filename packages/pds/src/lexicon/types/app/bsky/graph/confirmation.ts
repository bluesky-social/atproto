/**
* GENERATED CODE - DO NOT MODIFY
*/
import * as ComAtprotoRepoStrongRef from '../../../com/atproto/repo/strongRef'

export interface Record {
  originator: Originator;
  assertion: ComAtprotoRepoStrongRef.Main;
  createdAt: string;
  [k: string]: unknown;
}

export interface Originator {
  did: string;
  declarationCid: string;
  [k: string]: unknown;
}
