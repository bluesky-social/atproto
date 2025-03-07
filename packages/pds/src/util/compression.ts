import compression, { filter as defaultFilter } from 'compression'

export default function () {
  return compression({
    filter: (req, res) =>
      res.getHeader('Content-type') === 'application/vnd.ipld.car' ||
      defaultFilter(req, res),
  })
}
