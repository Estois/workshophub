import { Router, IRouter } from 'express'

const router: IRouter = Router()

router.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'workshophub-api',
  })
})

export default router
