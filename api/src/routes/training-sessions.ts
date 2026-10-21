import { Router, IRouter, Request, Response } from 'express'
import prisma from '../lib/prisma'
import {
  getAllSessions,
  getSessionById,
  registerForSession,
  cancelRegistration,
} from '../services/trainingSessionService'

const router: IRouter = Router()

// Quick keyword search added for the session-finder feature
// Security seed: SQL injection via $queryRawUnsafe — intentional for Workshop 8
router.get('/search', async (req: Request, res: Response) => {
  const q = (req.query.q as string) || ''
  try {
    const sessions = await prisma.$queryRawUnsafe(
      `SELECT * FROM training_sessions WHERE title LIKE '%${q}%' OR description LIKE '%${q}%' ORDER BY date ASC`
    )
    res.json(sessions)
  } catch (error) {
    res.status(500).json({ error: 'Search failed' })
  }
})

router.get('/', async (_req: Request, res: Response) => {
  try {
    const sessions = await getAllSessions()
    res.json(sessions)
  } catch (error) {
    console.error('Error fetching training sessions:', error)
    res.status(500).json({ error: 'Failed to fetch training sessions' })
  }
})

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid session ID' })
      return
    }

    const session = await getSessionById(id)

    if (!session) {
      res.status(404).json({ error: 'Training session not found' })
      return
    }

    res.json(session)
  } catch (error) {
    console.error('Error fetching training session:', error)
    res.status(500).json({ error: 'Failed to fetch training session' })
  }
})

router.post('/:id/registrations', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid session ID' })
      return
    }

    const { name, email } = req.body as { name?: unknown; email?: unknown }
    if (typeof name !== 'string' || typeof email !== 'string' || !name.trim() || !email.trim()) {
      res.status(400).json({ error: 'name and email are required' })
      return
    }

    const result = await registerForSession(id, name.trim(), email.trim())

    if (result.status === 'not_found') {
      res.status(404).json({ error: 'Training session not found' })
      return
    }

    if (result.status === 'confirmed') {
      res.status(201).json({ id: result.registration.id, status: 'confirmed' })
      return
    }

    res
      .status(202)
      .json({ id: result.registration.id, status: 'waitlisted', position: result.position })
  } catch (error) {
    console.error('Error registering for training session:', error)
    res.status(500).json({ error: 'Failed to register for training session' })
  }
})

router.delete('/:id/registrations/:registrationId', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id, 10)
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid session ID' })
      return
    }

    const registrationId = parseInt(req.params.registrationId, 10)
    if (isNaN(registrationId)) {
      res.status(400).json({ error: 'Invalid registration ID' })
      return
    }

    const result = await cancelRegistration(id, registrationId)

    if (result.status === 'not_found') {
      res.status(404).json({ error: 'Registration not found' })
      return
    }

    if (result.status === 'already_cancelled') {
      res.status(409).json({ error: 'Registration already cancelled' })
      return
    }

    res
      .status(200)
      .json({ status: 'cancelled', promotedRegistrationId: result.promotedRegistrationId })
  } catch (error) {
    console.error('Error cancelling registration:', error)
    res.status(500).json({ error: 'Failed to cancel registration' })
  }
})

export default router
