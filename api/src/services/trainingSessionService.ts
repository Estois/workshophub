import { Registration } from '@prisma/client'
import prisma from '../lib/prisma'

export async function getAllSessions() {
  return prisma.trainingSession.findMany({
    orderBy: { date: 'asc' },
  })
}

export async function getSessionById(id: number) {
  return prisma.trainingSession.findUnique({
    where: { id },
  })
}

export type RegisterForSessionResult =
  | { status: 'created'; registration: Registration }
  | { status: 'not_found' }
  | { status: 'full' }

export async function registerForSession(
  sessionId: number,
  name: string,
  email: string
): Promise<RegisterForSessionResult> {
  return prisma.$transaction(async (tx) => {
    const session = await tx.trainingSession.findUnique({ where: { id: sessionId } })
    if (!session) {
      return { status: 'not_found' }
    }

    // Atomic guard against over-booking: relies on SQLite's single-writer
    // transaction serialization. Re-check isolation guarantees if this
    // service ever targets a datastore with concurrent writer connections.
    const updateResult = await tx.trainingSession.updateMany({
      where: { id: sessionId, registered: { lt: session.capacity } },
      data: { registered: { increment: 1 } },
    })

    if (updateResult.count === 0) {
      return { status: 'full' }
    }

    const registration = await tx.registration.create({
      data: { name, email, trainingSessionId: sessionId },
    })

    return { status: 'created', registration }
  })
}
