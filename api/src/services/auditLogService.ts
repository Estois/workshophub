import { AuditLog } from '@prisma/client'
import prisma from '../lib/prisma'

export type AuditHistoryResult = { status: 'not_found' } | { status: 'ok'; history: AuditLog[] }

export async function getAuditHistory(
  sessionId: number,
  registrationId: number
): Promise<AuditHistoryResult> {
  const registration = await prisma.registration.findUnique({ where: { id: registrationId } })
  if (!registration || registration.trainingSessionId !== sessionId) {
    return { status: 'not_found' }
  }

  const history = await prisma.auditLog.findMany({
    where: { registrationId },
    orderBy: { changedAt: 'asc' },
  })

  return { status: 'ok', history }
}
