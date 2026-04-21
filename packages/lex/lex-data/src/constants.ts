/**
 * **CBOR Record Size**: try to keep individual records to a few dozen KBytes.
 * If you need to store more data, even text data, consider using a blob
 * instead. A reasonable maximum record size limit (MAX_CBOR_RECORD_SIZE) is 1
 * MiByte (1 mebibyte, or 1,048,576 bytes). Note that as of August 2025, the
 * subscribeRepos Lexicon limits #commit message block size to 2,000,000 bytes
 * (not mebibytes), so only a single 1 MiByte record can be created or updated
 * per commit.
 *
 * @see
 * {@link https://atproto.com/guides/data-validation#recommended-data-limits}
 */
export const MAX_CBOR_RECORD_SIZE = 1048576 // 1024 * 1024

/**
 * **JSON Record Size**: the CBOR encoding is "canonical" for records, so
 * focusing only on that encoding would make sense. But sometimes it is good to
 * also have a limit on JSON encoding size. A reasonable limit
 * (MAX_JSON_RECORD_SIZE) is 2 MiByte (2,097,152 bytes).
 *
 * @see
 * {@link https://atproto.com/guides/data-validation#recommended-data-limits}
 */
export const MAX_JSON_RECORD_SIZE = 2097152 // 2 * 1024 * 1024

/**
 * **General string length**: an overall length limit on strings within a
 * record, including both those with and without Lexicon-specified string
 * lengths. Measured as bytes (UTF-8 encoded). Should try to keep these to tens
 * of KBytes at most. For an upper-bound limit (MAX_RECORD_STRING_LEN),
 * reasonable to just rely on the overall CBOR record size limit. Notably, some
 * early implementations had a 8 KByte (8192 bytes) limit.
 *
 * @see
 * {@link https://atproto.com/guides/data-validation#recommended-data-limits}
 */
export const MAX_RECORD_STRING_LEN = MAX_JSON_RECORD_SIZE

/**
 * **General bytes length**: same as the string limit, but for binary data
 * (MAX_RECORD_BYTES_LEN). Recommend relying on the overall CBOR record size
 * limit. As with record size overall, if more than a few dozen KBytes are
 * needed, recommendation is to use blobs.
 *
 * @see
 * {@link https://atproto.com/guides/data-validation#recommended-data-limits}
 */
export const MAX_RECORD_BYTES_LEN = MAX_CBOR_RECORD_SIZE

/**
 * **Container nesting depth**: for example, how many layers of map inside an
 * array inside an array, etc. If your CBOR or JSON parsing library supports a
 * limit, the default is probably fine.
 *
 * @see
 * {@link https://atproto.com/guides/data-validation#recommended-data-limits}
 */
export const MAX_CBOR_NESTED_LEVELS = 32

/**
 * **Container element count**: for example, how many keys in a map, or elements
 * in an array. If your CBOR or JSON parsing library supports a limit, the
 * default is probably fine.
 *
 * @see {@link https://atproto.com/guides/data-validation#recommended-data-limits}
 */
export const MAX_CBOR_CONTAINER_LEN = 131072 // 128 * 1024

/**
 * **Object key string length**: for example, how many bytes (UTF-8 encoded) are
 * allowed in any key of an object. If your CBOR or JSON parsing library
 * supports a limit, the default is probably fine.
 *
 * @see {@link https://atproto.com/guides/data-validation#recommended-data-limits}
 */
export const MAX_CBOR_OBJECT_KEY_LEN = 8192

/**
 * Similar to {@link MAX_CBOR_NESTED_LEVELS}, but for parsing of JSON payloads
 * from other services.
 */
export const MAX_PAYLOAD_NESTED_LEVELS = 5_000
