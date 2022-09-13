# ADX URI Scheme

The `adx` URL scheme is used to address records in the ADX network.

```
adx-url   = "adx://" authority path [ "?" query ] [ "#" fragment ]
authority = reg-name / did
path      = [ "/" coll-ns "/" coll-id [ "/" record-id ] ]
coll-ns   = reg-name
coll-id   = 1*pchar
record-id = 1*pchar
```

`did` is defined in [https://w3c.github.io/did-core/#did-syntax](https://w3c.github.io/did-core/#did-syntax).

`reg-name` is defined in [https://www.rfc-editor.org/rfc/rfc3986#section-3.2.2](https://www.rfc-editor.org/rfc/rfc3986#section-3.2.2).

`pchar` is defined in [https://www.rfc-editor.org/rfc/rfc3986#section-3.3](https://www.rfc-editor.org/rfc/rfc3986#section-3.3).

`query` is defined in [https://www.rfc-editor.org/rfc/rfc3986#section-3.4](https://www.rfc-editor.org/rfc/rfc3986#section-3.4).

`fragment` is defined in [https://www.rfc-editor.org/rfc/rfc3986#section-3.5](https://www.rfc-editor.org/rfc/rfc3986#section-3.5). 

The fragment segment only has meaning if the URL references a record. Its value maps to a subrecord with the matching `"id"` value.

Some example `adx` URLs:


<table>
  <tr>
   <td>Repository
   </td>
   <td><code>adx://bob.com</code>
   </td>
  </tr>
  <tr>
   <td>Repository
   </td>
   <td><code>adx://did:web:bob.com</code>
   </td>
  </tr>
  <tr>
   <td>Collection
   </td>
   <td><code>adx://bob.com/example.com/songs</code>
   </td>
  </tr>
  <tr>
   <td>Record
   </td>
   <td><code>adx://bob.com/example.com/songs/3yI5-c1z-cc2p-1a</code>
   </td>
  </tr>
</table>