import { JsonValue as Value } from "@atproto/common"
import { Selectable } from "kysely"
import { JsonEncoded } from "../../../db"

export type JsonValue = Omit<Value, "unknown">;

export interface AuthClaims {
  did: string
  idpId: string,
  sub: JsonEncoded<JsonValue>,
  picture: string | null,
  email: string | null
}

export type AuthClaimsData = Omit<AuthClaims, "sub"> & {
  sub: JsonValue;
};

export type AuthClaimsEntry = Selectable<AuthClaims>

export const tableName = 'auth_claims'

export type PartialDB = { [tableName]: AuthClaims }
