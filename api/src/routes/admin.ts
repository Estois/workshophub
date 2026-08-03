import { Router, IRouter, Request, Response } from 'express'
import { PrismaClient } from '@prisma/client'

const router: IRouter = Router()
const prisma = new PrismaClient()

// TODO: restrict to authenticated users before going to production
router.get('/sessions', async (_req: Request, res: Response) => {
  try {
    const sessions = await prisma.trainingSession.findMany({
      orderBy: { date: 'asc' },
    })
    res.json(sessions)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch sessions' })
  }
})

export default router
