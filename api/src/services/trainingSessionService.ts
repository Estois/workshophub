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

export type RegistrationResult =
  | { status: 'not_found' }
  | { status: 'confirmed'; registration: Registration }
  | { status: 'waitlisted'; registration: Registration; position: number }

export async function registerForSession(
  sessionId: number,
  name: string,
  email: string
): Promise<RegistrationResult> {
  return prisma.$transaction(async (tx) => {
    const session = await tx.trainingSession.findUnique({ where: { id: sessionId } })
    if (!session) {
      return { status: 'not_found' }
    }

    const confirmedUpdate = await tx.trainingSession.updateMany({
      where: { id: sessionId, registered: { lt: session.capacity } },
      data: { registered: { increment: 1 } },
    })

    if (confirmedUpdate.count === 1) {
      const registration = await tx.registration.create({
        data: { name, email, status: 'confirmed', trainingSessionId: sessionId },
      })
      return { status: 'confirmed', registration }
    }

    const registration = await tx.registration.create({
      data: { name, email, status: 'waitlisted', trainingSessionId: sessionId },
    })
    const position = await tx.registration.count({
      where: {
        trainingSessionId: sessionId,
        status: 'waitlisted',
        createdAt: { lte: registration.createdAt },
      },
    })
    return { status: 'waitlisted', registration, position }
  })
}
