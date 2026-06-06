import dotenv from 'dotenv'
dotenv.config()

export const apiKeyAuth = (req, res, next) => {
  const key = req.headers['x-api-key']

  if (!key || key !== process.env.API_KEY) {
    return res.status(401).json({ error: 'Unauthorized — invalid or missing API key' })
  }

  next()
}