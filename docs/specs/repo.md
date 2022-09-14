# ADX Repository Structure

The "repository" is a collection of signed records.

It is an implementation of a [Merkle Search Tree (MST)](https://hal.inria.fr/hal-02303490/document). The MST is an ordered, insert-order-independent, deterministic tree. Keys are laid out in alphabetic order. The key insight of an MST is that each key is hashed and starting 0s are counted to determine which layer it falls on (5 zeros for ~32 fanout).

This is a merkle tree, so each subtree is referred to by it's hash (CID). When a leaf is changed, ever tree on the path to that leaf is changed as well, thereby updating the root hash.

## Encodings

All data in the repository is encoded using [CBOR](https://cbor.io/). The following value types are supported:

<table>
  <tr>
   <td><code>null</code>
   </td>
   <td>A<a href="https://datatracker.ietf.org/doc/html/rfc8949#section-3.3"> CBOR simple value</a> (major type 7, subtype 24) with a simple value of 22 (null). 
   </td>
  </tr>
  <tr>
   <td><code>boolean</code>
   </td>
   <td>A<a href="https://datatracker.ietf.org/doc/html/rfc8949#section-3.3"> CBOR simple value</a> (major type 7, subtype 24) with a simple value of 21 (true) or 20 (false). 
   </td>
  </tr>
  <tr>
   <td><code>integer</code>
   </td>
   <td>A<a href="https://datatracker.ietf.org/doc/html/rfc8949#section-3.1"> CBOR integer</a> (major type 0 or 1), choosing the shortest byte representation. 
   </td>
  </tr>
  <tr>
   <td><code>float</code>
   </td>
   <td>A<a href="https://datatracker.ietf.org/doc/html/rfc8949#section-3.1"> CBOR floating-point number</a> (major type 7). All floating point values <em>MUST</em> be encoded as 64-bits (additional type value 27), even for integral values.
   </td>
  </tr>
  <tr>
   <td><code>string</code>
   </td>
   <td>A<a href="https://datatracker.ietf.org/doc/html/rfc8949#section-3.1"> CBOR string</a> (major type 3).
   </td>
  </tr>
  <tr>
   <td><code>list</code>
   </td>
   <td>A<a href="https://datatracker.ietf.org/doc/html/rfc8949#section-3.1"> CBOR array</a> (major type 4), where each element of the list is added, in order, as a value of the array according to its type.
   </td>
  </tr>
  <tr>
   <td><code>map</code>
   </td>
   <td>A<a href="https://datatracker.ietf.org/doc/html/rfc8949#section-3.1"> CBOR map</a> (major type 5), where each entry is represented as a member of the CBOR map. The entry key is expressed as a<a href="https://datatracker.ietf.org/doc/html/rfc8949#section-3.1"> CBOR string</a> (major type 3) as the key.
   </td>
  </tr>
</table>

TODO:

- Are we missing value types? Binary? CID/Link?

### CBOR normalization

TODO: describe normalization algorithm

## Data layout

The data layout establishes the units of network-transmissable data. It includes the following three major groupings:

|Grouping|Description|
|-|-|
|**Repository**|Repositories are the dataset of a single "actor" (ie user) in the ADX network. Every user has a single repository which is identified by a [DID](https://w3c.github.io/did-core/).|
|**Collection**|A collection is an ordered list of records. Every collection has a type and is identified by a schema ID. Collections may contain records of any type and cannot enforce any constraints on them.|
|**Record**|A record is a key/value document. It is the smallest unit of data which can be transmitted over the network. Every record has a type and is identified by a key which is chosen by the writing software.|

