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
