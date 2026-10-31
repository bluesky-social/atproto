group "default" {
  targets = ["bsky", "bsync", "ozone", "pds"]
}

target "_service" {
  context = "."
}

target "bsky" {
  inherits = ["_service"]
  target   = "bsky"
  tags     = ["bsky:local"]
}

target "bsync" {
  inherits = ["_service"]
  target   = "bsync"
  tags     = ["bsync:local"]
}

target "ozone" {
  inherits = ["_service"]
  target   = "ozone"
  tags     = ["ozone:local"]
}

target "pds" {
  inherits = ["_service"]
  target   = "pds"
  tags     = ["pds:local"]
}
