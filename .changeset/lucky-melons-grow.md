---
'@atproto/lex-data': patch
---

Export the recommended data-limit constants (`MAX_CBOR_NESTED_LEVELS`, `MAX_CBOR_CONTAINER_LEN`, `MAX_CBOR_OBJECT_KEY_LEN`, `MAX_PAYLOAD_NESTED_LEVELS`, …), and avoid a buffer copy when decoding UTF-8 from a `Buffer`.
