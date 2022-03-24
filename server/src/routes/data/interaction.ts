import express from 'express'

const router = express.Router()

// CREATE
router.post('/', async (req, res) => {
  res.status(200).send()
})

// UPDATE
router.put('/', async (req, res) => {
  res.status(200).send()
})

// DELETE
router.delete('/', async (req, res) => {
  res.status(200).send()
})

export default router
