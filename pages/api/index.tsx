import * as S from "@common/server";

// NOTE(jim):
// CORS API example.
export default async function apiIndex(req, res) {
  await S.cors(req, res);

  res.json({ example: process.env.EXAMPLE_SECRET });
}
