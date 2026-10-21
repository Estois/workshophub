import { Prisma, Registration } from '@prisma/client'
import prisma from '../lib/prisma'

export async function getAllSessions() {
  const sessions = await prisma.trainingSession.findMany({
    orderBy: { date: 'asc' },
    include: { _count: { select: { registrations: { where: { status: 'waitlisted' } } } } },
  })
  return sessions.map(({ _count, ...session }) => ({
    ...session,
    waitlistCount: _count.registrations,
  }))
}

export async function getSessionById(id: number) {
  const session = await prisma.trainingSession.findUnique({
    where: { id },
    include: { _count: { select: { registrations: { where: { status: 'waitlisted' } } } } },
  })
  if (!session) {
    return null
  }
  const { _count, ...rest } = session
  return { ...rest, waitlistCount: _count.registrations }
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

export type CancellationResult =
  | { status: 'not_found' }
  | { status: 'already_cancelled' }
  | { status: 'cancelled'; promotedRegistrationId: number | null }

// WH-8 trigger point: notification delivery is not implemented yet, this is a no-op seam.
function notifyPromotion(_registrationId: number): void {
  return
}

export async function promoteFromWaitlist(
  tx: Prisma.TransactionClient,
  sessionId: number
): Promise<number | null> {
  const candidate = await tx.registration.findFirst({
    where: { trainingSessionId: sessionId, status: 'waitlisted' },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  })
  if (!candidate) {
    return null
  }

  const update = await tx.registration.updateMany({
    where: { id: candidate.id, status: 'waitlisted' },
    data: { status: 'confirmed' },
  })
  if (update.count === 0) {
    return null
  }

  await tx.trainingSession.update({
    where: { id: sessionId },
    data: { registered: { increment: 1 } },
  })
  notifyPromotion(candidate.id)
  return candidate.id
}

export async function cancelRegistration(
  sessionId: number,
  registrationId: number
): Promise<CancellationResult> {
  return prisma.$transaction(async (tx) => {
    const registration = await tx.registration.findUnique({ where: { id: registrationId } })
    if (!registration || registration.trainingSessionId !== sessionId) {
      return { status: 'not_found' }
    }

    if (registration.status === 'cancelled') {
      return { status: 'already_cancelled' }
    }

    if (registration.status === 'confirmed') {
      const update = await tx.registration.updateMany({
        where: { id: registrationId, status: 'confirmed' },
        data: { status: 'cancelled' },
      })
      if (update.count === 0) {
        return { status: 'already_cancelled' }
      }
      await tx.trainingSession.update({
        where: { id: sessionId },
        data: { registered: { decrement: 1 } },
      })
      const promotedRegistrationId = await promoteFromWaitlist(tx, sessionId)
      return { status: 'cancelled', promotedRegistrationId }
    }

    const update = await tx.registration.updateMany({
      where: { id: registrationId, status: 'waitlisted' },
      data: { status: 'cancelled' },
    })
    if (update.count === 0) {
      return { status: 'already_cancelled' }
    }
    return { status: 'cancelled', promotedRegistrationId: null }
  })
}
