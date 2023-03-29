import { CID } from 'multiformats/cid'

export const vectors = [
  {
    name: 'basic',
    json: {
      a: 'abc',
      b: 123,
      c: true,
      e: null,
      f: ['abc', 'def', 'ghi'],
      g: {
        h: 'abc',
        i: 123,
        j: true,
        k: ['abc', 'def', 'ghi'],
      },
    },
    ipld: {
      a: 'abc',
      b: 123,
      c: true,
      e: null,
      f: ['abc', 'def', 'ghi'],
      g: {
        h: 'abc',
        i: 123,
        j: true,
        k: ['abc', 'def', 'ghi'],
      },
    },
    cbor: new Uint8Array([
      166, 97, 97, 99, 97, 98, 99, 97, 98, 24, 123, 97, 99, 245, 97, 101, 246,
      97, 102, 131, 99, 97, 98, 99, 99, 100, 101, 102, 99, 103, 104, 105, 97,
      103, 164, 97, 104, 99, 97, 98, 99, 97, 105, 24, 123, 97, 106, 245, 97,
      107, 131, 99, 97, 98, 99, 99, 100, 101, 102, 99, 103, 104, 105,
    ]),
    cid: 'bafyreiaioukcatdbdltzqznmyqmwgpgmoex62tkwqtdmganxgv3v5bn2o4',
  },
  {
    name: 'ipld',
    json: {
      a: {
        $link: 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      },
      b: {
        $bytes: 'nFERjvLLiw9qm45JrqH9QTzyC2Lu1Xb4ne6+sBrCzI0',
      },
    },
    ipld: {
      a: CID.parse(
        'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      ),
      b: new Uint8Array([
        156, 81, 17, 142, 242, 203, 139, 15, 106, 155, 142, 73, 174, 161, 253,
        65, 60, 242, 11, 98, 238, 213, 118, 248, 157, 238, 190, 176, 26, 194,
        204, 141,
      ]),
    },
    cbor: new Uint8Array([
      162, 97, 97, 216, 42, 88, 37, 0, 1, 113, 18, 32, 101, 6, 42, 90, 90, 0,
      252, 22, 215, 60, 105, 68, 35, 124, 203, 193, 91, 28, 74, 114, 52, 72,
      147, 54, 137, 29, 9, 23, 65, 162, 57, 208, 97, 98, 88, 32, 156, 81, 17,
      142, 242, 203, 139, 15, 106, 155, 142, 73, 174, 161, 253, 65, 60, 242, 11,
      98, 238, 213, 118, 248, 157, 238, 190, 176, 26, 194, 204, 141,
    ]),
    cid: 'bafyreif37nlcsyb4ckm2i7y3w2ctnebzkib7ekzmv3tvl3mo5og2gxot5y',
  },
  {
    name: 'ipldArray',
    json: [
      {
        $link: 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      },
      {
        $link: 'bafyreigoxt64qghytzkr6ik7qvtzc7lyytiq5xbbrokbxjows2wp7vmo6q',
      },
      {
        $link: 'bafyreiaizynclnqiolq7byfpjjtgqzn4sfrsgn7z2hhf6bo4utdwkin7ke',
      },
      {
        $link: 'bafyreifd4w4tcr5tluxz7osjtnofffvtsmgdqcfrfi6evjde4pl27lrjpy',
      },
    ],
    ipld: [
      CID.parse('bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a'),
      CID.parse('bafyreigoxt64qghytzkr6ik7qvtzc7lyytiq5xbbrokbxjows2wp7vmo6q'),
      CID.parse('bafyreiaizynclnqiolq7byfpjjtgqzn4sfrsgn7z2hhf6bo4utdwkin7ke'),
      CID.parse('bafyreifd4w4tcr5tluxz7osjtnofffvtsmgdqcfrfi6evjde4pl27lrjpy'),
    ],
    cbor: new Uint8Array([
      132, 216, 42, 88, 37, 0, 1, 113, 18, 32, 101, 6, 42, 90, 90, 0, 252, 22,
      215, 60, 105, 68, 35, 124, 203, 193, 91, 28, 74, 114, 52, 72, 147, 54,
      137, 29, 9, 23, 65, 162, 57, 208, 216, 42, 88, 37, 0, 1, 113, 18, 32, 206,
      188, 253, 200, 24, 248, 158, 85, 31, 33, 95, 133, 103, 145, 125, 120, 196,
      209, 14, 220, 33, 139, 148, 27, 165, 214, 150, 172, 255, 213, 142, 244,
      216, 42, 88, 37, 0, 1, 113, 18, 32, 8, 206, 26, 37, 182, 8, 114, 225, 240,
      224, 175, 74, 102, 104, 101, 188, 145, 99, 35, 55, 249, 209, 206, 95, 5,
      220, 164, 199, 101, 33, 191, 81, 216, 42, 88, 37, 0, 1, 113, 18, 32, 163,
      229, 185, 49, 71, 179, 93, 47, 159, 186, 73, 155, 92, 82, 150, 179, 147,
      12, 56, 8, 177, 42, 60, 74, 164, 100, 227, 215, 175, 174, 41, 126,
    ]),
    cid: 'bafyreiaj3udmqlqrcbjxjayzuxwp64gt64olcbjfrkldzoqponpru6gq4m',
  },
  {
    name: 'ipldNested',
    json: {
      a: {
        b: [
          {
            d: [
              {
                $link:
                  'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
              },
              {
                $link:
                  'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
              },
            ],
            e: [
              {
                $bytes: 'nFERjvLLiw9qm45JrqH9QTzyC2Lu1Xb4ne6+sBrCzI0',
              },
              {
                $bytes: 'iE+sPoHobU9tSIqGI+309LLCcWQIRmEXwxcoDt19tas',
              },
            ],
          },
        ],
      },
    },
    ipld: {
      a: {
        b: [
          {
            d: [
              CID.parse(
                'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
              ),
              CID.parse(
                'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
              ),
            ],
            e: [
              new Uint8Array([
                156, 81, 17, 142, 242, 203, 139, 15, 106, 155, 142, 73, 174,
                161, 253, 65, 60, 242, 11, 98, 238, 213, 118, 248, 157, 238,
                190, 176, 26, 194, 204, 141,
              ]),
              new Uint8Array([
                136, 79, 172, 62, 129, 232, 109, 79, 109, 72, 138, 134, 35, 237,
                244, 244, 178, 194, 113, 100, 8, 70, 97, 23, 195, 23, 40, 14,
                221, 125, 181, 171,
              ]),
            ],
          },
        ],
      },
    },
    cbor: new Uint8Array([
      161, 97, 97, 161, 97, 98, 129, 162, 97, 100, 130, 216, 42, 88, 37, 0, 1,
      113, 18, 32, 101, 6, 42, 90, 90, 0, 252, 22, 215, 60, 105, 68, 35, 124,
      203, 193, 91, 28, 74, 114, 52, 72, 147, 54, 137, 29, 9, 23, 65, 162, 57,
      208, 216, 42, 88, 37, 0, 1, 113, 18, 32, 101, 6, 42, 90, 90, 0, 252, 22,
      215, 60, 105, 68, 35, 124, 203, 193, 91, 28, 74, 114, 52, 72, 147, 54,
      137, 29, 9, 23, 65, 162, 57, 208, 97, 101, 130, 88, 32, 156, 81, 17, 142,
      242, 203, 139, 15, 106, 155, 142, 73, 174, 161, 253, 65, 60, 242, 11, 98,
      238, 213, 118, 248, 157, 238, 190, 176, 26, 194, 204, 141, 88, 32, 136,
      79, 172, 62, 129, 232, 109, 79, 109, 72, 138, 134, 35, 237, 244, 244, 178,
      194, 113, 100, 8, 70, 97, 23, 195, 23, 40, 14, 221, 125, 181, 171,
    ]),
    cid: 'bafyreid3imdulnhgeytpf6uk7zahjvrsqlofkmm5b5ub2maw4kqus6jp4i',
  },
  {
    name: 'poorlyFormatted',
    json: {
      a: 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      b: 'nFERjvLLiw9qm45JrqH9QTzyC2Lu1Xb4ne6+sBrCzI0',
      c: {
        $link: 'bafyreigoxt64qghytzkr6ik7qvtzc7lyytiq5xbbrokbxjows2wp7vmo6q',
        another: 'bad value',
      },
      d: {
        $bytes: 'nFERjvLLiw9qm45JrqH9QTzyC2Lu1Xb4ne6+sBrCzI0',
        another: 'bad value',
      },
      e: {
        '/': 'bafyreigoxt64qghytzkr6ik7qvtzc7lyytiq5xbbrokbxjows2wp7vmo6q',
      },
      f: {
        '/': {
          bytes: 'nFERjvLLiw9qm45JrqH9QTzyC2Lu1Xb4ne6+sBrCzI0',
        },
      },
    },
    ipld: {
      a: 'bafyreidfayvfuwqa7qlnopdjiqrxzs6blmoeu4rujcjtnci5beludirz2a',
      b: 'nFERjvLLiw9qm45JrqH9QTzyC2Lu1Xb4ne6+sBrCzI0',
      c: {
        $link: 'bafyreigoxt64qghytzkr6ik7qvtzc7lyytiq5xbbrokbxjows2wp7vmo6q',
        another: 'bad value',
      },
      d: {
        $bytes: 'nFERjvLLiw9qm45JrqH9QTzyC2Lu1Xb4ne6+sBrCzI0',
        another: 'bad value',
      },
      e: {
        '/': 'bafyreigoxt64qghytzkr6ik7qvtzc7lyytiq5xbbrokbxjows2wp7vmo6q',
      },
      f: {
        '/': {
          bytes: 'nFERjvLLiw9qm45JrqH9QTzyC2Lu1Xb4ne6+sBrCzI0',
        },
      },
    },
    cbor: new Uint8Array([
      166, 97, 97, 120, 59, 98, 97, 102, 121, 114, 101, 105, 100, 102, 97, 121,
      118, 102, 117, 119, 113, 97, 55, 113, 108, 110, 111, 112, 100, 106, 105,
      113, 114, 120, 122, 115, 54, 98, 108, 109, 111, 101, 117, 52, 114, 117,
      106, 99, 106, 116, 110, 99, 105, 53, 98, 101, 108, 117, 100, 105, 114,
      122, 50, 97, 97, 98, 120, 43, 110, 70, 69, 82, 106, 118, 76, 76, 105, 119,
      57, 113, 109, 52, 53, 74, 114, 113, 72, 57, 81, 84, 122, 121, 67, 50, 76,
      117, 49, 88, 98, 52, 110, 101, 54, 43, 115, 66, 114, 67, 122, 73, 48, 97,
      99, 162, 101, 36, 108, 105, 110, 107, 120, 59, 98, 97, 102, 121, 114, 101,
      105, 103, 111, 120, 116, 54, 52, 113, 103, 104, 121, 116, 122, 107, 114,
      54, 105, 107, 55, 113, 118, 116, 122, 99, 55, 108, 121, 121, 116, 105,
      113, 53, 120, 98, 98, 114, 111, 107, 98, 120, 106, 111, 119, 115, 50, 119,
      112, 55, 118, 109, 111, 54, 113, 103, 97, 110, 111, 116, 104, 101, 114,
      105, 98, 97, 100, 32, 118, 97, 108, 117, 101, 97, 100, 162, 102, 36, 98,
      121, 116, 101, 115, 120, 43, 110, 70, 69, 82, 106, 118, 76, 76, 105, 119,
      57, 113, 109, 52, 53, 74, 114, 113, 72, 57, 81, 84, 122, 121, 67, 50, 76,
      117, 49, 88, 98, 52, 110, 101, 54, 43, 115, 66, 114, 67, 122, 73, 48, 103,
      97, 110, 111, 116, 104, 101, 114, 105, 98, 97, 100, 32, 118, 97, 108, 117,
      101, 97, 101, 161, 97, 47, 120, 59, 98, 97, 102, 121, 114, 101, 105, 103,
      111, 120, 116, 54, 52, 113, 103, 104, 121, 116, 122, 107, 114, 54, 105,
      107, 55, 113, 118, 116, 122, 99, 55, 108, 121, 121, 116, 105, 113, 53,
      120, 98, 98, 114, 111, 107, 98, 120, 106, 111, 119, 115, 50, 119, 112, 55,
      118, 109, 111, 54, 113, 97, 102, 161, 97, 47, 161, 101, 98, 121, 116, 101,
      115, 120, 43, 110, 70, 69, 82, 106, 118, 76, 76, 105, 119, 57, 113, 109,
      52, 53, 74, 114, 113, 72, 57, 81, 84, 122, 121, 67, 50, 76, 117, 49, 88,
      98, 52, 110, 101, 54, 43, 115, 66, 114, 67, 122, 73, 48,
    ]),
    cid: 'bafyreico7wgbbfe6dpfsuednrtrlh6t2yjl6xq5rf32gl3pgwhwxk77cn4',
  },
]

export default vectors
