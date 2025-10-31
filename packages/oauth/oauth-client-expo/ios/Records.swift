import ExpoModulesCore

struct EncodedJWK: Record {
  @Field
  var kty: String

  @Field
  var crv: String

  @Field
  var kid: String

  @Field
  var x: String

  @Field
  var y: String

  @Field
  var d: String

  @Field
  var alg: String
}

struct VerifyOptions: Record {
  @Field
  var audience: String?

  @Field
  var clockTolerance: Double?

  @Field
  var issuer: String?

  @Field
  var maxTokenAge: Double?

  @Field
  var subject: String?

  @Field
  var typ: String?

  @Field
  var currentDate: Date?

  @Field
  var requiredClaims: [String]?
}

struct VerifyResult: Record {
  @Field
  var payload: String

  @Field
  var protectedHeader: [String: Any]
}
