package expo.modules.atprotooauthclient

import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class EncodedJWK : Record {
  @Field
  var kty: String = ""

  @Field
  var crv: String = ""

  @Field
  var kid: String = ""

  @Field
  var x: String = ""

  @Field
  var y: String = ""

  @Field
  var d: String = ""

  @Field
  var alg: String = ""
}

class VerifyOptions : Record {
  @Field
  var audience: String? = null

  @Field
  var checkTolerance: Double? = null

  @Field
  var issuer: String? = null

  @Field
  var maxTokenAge: Double? = null

  @Field
  var subject: String? = null

  @Field
  var typ: String? = null

  @Field
  var currentDate: Double? = null

  @Field
  var requiredClaims: Array<String>? = null
}

class VerifyResult : Record {
  @Field
  var payload: String = ""

  @Field
  var protectedHeader: Map<String, Any> = emptyMap()
}
