import {
  getAllSessions,
  getSessionById,
  registerForSession,
  cancelRegistration,
  promoteFromWaitlist,
  getRegistrationsForSession,
} from '../../src/services/trainingSessionService'
import prisma from '../../src/lib/prisma'
import { notifyEmployee } from '../../src/services/notificationService'

jest.mock('../../src/services/notificationService', () => ({
  __esModule: true,
  notifyEmployee: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    trainingSession: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    registration: {
      create: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

const mockFindMany = prisma.trainingSession.findMany as jest.Mock
const mockFindUnique = prisma.trainingSession.findUnique as jest.Mock
const mockUpdateMany = prisma.trainingSession.updateMany as jest.Mock
const mockSessionUpdate = prisma.trainingSession.update as jest.Mock
const mockRegistrationCreate = prisma.registration.create as jest.Mock
const mockRegistrationCount = prisma.registration.count as jest.Mock
const mockRegistrationFindMany = prisma.registration.findMany as jest.Mock
const mockRegistrationFindUnique = prisma.registration.findUnique as jest.Mock
const mockRegistrationFindFirst = prisma.registration.findFirst as jest.Mock
const mockRegistrationUpdateMany = prisma.registration.updateMany as jest.Mock
const mockTransaction = prisma.$transaction as jest.Mock
const mockNotifyEmployee = notifyEmployee as jest.Mock

const mockSession = {
  id: 1,
  title: 'TDD in Agentic Development Loop',
  description: 'Learn test-driven development with AI assistance.',
  date: new Date('2026-07-01T09:00:00Z'),
  capacity: 20,
  registered: 5,
  location: 'Room A',
  deliveryMode: 'In-person',
  status: 'open',
}

const mockSessionWithCount = { ...mockSession, _count: { registrations: 0 } }

afterEach(() => {
  jest.clearAllMocks()
})

describe('getAllSessions', () => {
  it('returns sessions ordered by date with waitlistCount', async () => {
    const sessions = [
      mockSessionWithCount,
      { ...mockSessionWithCount, id: 2, date: new Date('2026-07-02T09:00:00Z') },
    ]
    mockFindMany.mockResolvedValue(sessions)

    const result = await getAllSessions()

    expect(result).toEqual([
      { ...mockSession, waitlistCount: 0 },
      { ...mockSession, id: 2, date: new Date('2026-07-02T09:00:00Z'), waitlistCount: 0 },
    ])
    expect(mockFindMany).toHaveBeenCalledWith({
      orderBy: { date: 'asc' },
      include: { _count: { select: { registrations: { where: { status: 'waitlisted' } } } } },
    })
  })

  it('returns an empty array when no sessions exist', async () => {
    mockFindMany.mockResolvedValue([])

    const result = await getAllSessions()

    expect(result).toEqual([])
  })
})

describe('getSessionById', () => {
  it('returns the matching session with waitlistCount', async () => {
    mockFindUnique.mockResolvedValue({ ...mockSessionWithCount, _count: { registrations: 2 } })

    const result = await getSessionById(1)

    expect(result).toEqual({ ...mockSession, waitlistCount: 2 })
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      include: { _count: { select: { registrations: { where: { status: 'waitlisted' } } } } },
    })
  })

  it('returns null when session does not exist', async () => {
    mockFindUnique.mockResolvedValue(null)

    const result = await getSessionById(999)

    expect(result).toBeNull()
  })
})

describe('registerForSession', () => {
  beforeEach(() => {
    mockTransaction.mockImplementation((callback: (tx: typeof prisma) => unknown) =>
      callback(prisma)
    )
  })

  it('returns not_found when the session does not exist', async () => {
    mockFindUnique.mockResolvedValue(null)

    const result = await registerForSession(999, 'Alice', 'alice@example.com')

    expect(result).toEqual({ status: 'not_found' })
  })

  it('returns confirmed when the session has space', async () => {
    mockFindUnique.mockResolvedValue({ ...mockSession, capacity: 20, registered: 5 })
    mockUpdateMany.mockResolvedValue({ count: 1 })
    mockRegistrationCreate.mockResolvedValue({
      id: 1,
      name: 'Alice',
      email: 'alice@example.com',
      status: 'confirmed',
      trainingSessionId: 1,
      createdAt: new Date('2026-07-01T00:00:00Z'),
    })

    const result = await registerForSession(1, 'Alice', 'alice@example.com')

    expect(result.status).toBe('confirmed')
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: 1, registered: { lt: 20 } },
      data: { registered: { increment: 1 } },
    })
    expect(mockRegistrationCreate).toHaveBeenCalledWith({
      data: {
        name: 'Alice',
        email: 'alice@example.com',
        status: 'confirmed',
        trainingSessionId: 1,
      },
    })
  })

  it('returns waitlisted with position when the session is full', async () => {
    mockFindUnique.mockResolvedValue({ ...mockSession, capacity: 20, registered: 20 })
    mockUpdateMany.mockResolvedValue({ count: 0 })
    mockRegistrationCreate.mockResolvedValue({
      id: 2,
      name: 'Bob',
      email: 'bob@example.com',
      status: 'waitlisted',
      trainingSessionId: 1,
      createdAt: new Date('2026-07-01T00:00:00Z'),
    })
    mockRegistrationCount.mockResolvedValue(3)

    const result = await registerForSession(1, 'Bob', 'bob@example.com')

    expect(result).toEqual({
      status: 'waitlisted',
      position: 3,
      registration: expect.objectContaining({ status: 'waitlisted' }),
    })
    expect(mockRegistrationCreate).toHaveBeenCalledWith({
      data: { name: 'Bob', email: 'bob@example.com', status: 'waitlisted', trainingSessionId: 1 },
    })
  })
})

describe('cancelRegistration', () => {
  beforeEach(() => {
    mockTransaction.mockImplementation((callback: (tx: typeof prisma) => unknown) =>
      callback(prisma)
    )
  })

  it('returns not_found when the registration does not exist', async () => {
    mockRegistrationFindUnique.mockResolvedValue(null)

    const result = await cancelRegistration(1, 999)

    expect(result).toEqual({ status: 'not_found' })
  })

  it('returns not_found when the registration belongs to a different session', async () => {
    mockRegistrationFindUnique.mockResolvedValue({
      id: 1,
      status: 'confirmed',
      trainingSessionId: 2,
    })

    const result = await cancelRegistration(1, 1)

    expect(result).toEqual({ status: 'not_found' })
  })

  it('returns already_cancelled when the registration is already cancelled', async () => {
    mockRegistrationFindUnique.mockResolvedValue({
      id: 1,
      status: 'cancelled',
      trainingSessionId: 1,
    })

    const result = await cancelRegistration(1, 1)

    expect(result).toEqual({ status: 'already_cancelled' })
    expect(mockRegistrationUpdateMany).not.toHaveBeenCalled()
  })

  it('cancels a confirmed registration, decrements registered, and finds no one to promote', async () => {
    mockRegistrationFindUnique.mockResolvedValue({
      id: 1,
      status: 'confirmed',
      trainingSessionId: 1,
    })
    mockRegistrationUpdateMany.mockResolvedValue({ count: 1 })
    mockSessionUpdate.mockResolvedValue({ id: 1 })
    mockRegistrationFindFirst.mockResolvedValue(null)

    const result = await cancelRegistration(1, 1)

    expect(result).toEqual({ status: 'cancelled', promotedRegistrationId: null })
    expect(mockRegistrationUpdateMany).toHaveBeenCalledWith({
      where: { id: 1, status: 'confirmed' },
      data: { status: 'cancelled' },
    })
    expect(mockSessionUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { registered: { decrement: 1 } },
    })
  })

  it('cancels a confirmed registration and promotes the oldest waitlisted employee', async () => {
    mockRegistrationFindUnique.mockResolvedValue({
      id: 1,
      status: 'confirmed',
      trainingSessionId: 1,
    })
    mockRegistrationUpdateMany
      .mockResolvedValueOnce({ count: 1 }) // cancellation
      .mockResolvedValueOnce({ count: 1 }) // promotion
    mockSessionUpdate.mockResolvedValue({ id: 1 })
    mockRegistrationFindFirst.mockResolvedValue({ id: 5, status: 'waitlisted' })

    const result = await cancelRegistration(1, 1)

    expect(result).toEqual({ status: 'cancelled', promotedRegistrationId: 5 })
    expect(mockRegistrationUpdateMany).toHaveBeenNthCalledWith(2, {
      where: { id: 5, status: 'waitlisted' },
      data: { status: 'confirmed' },
    })
    expect(mockSessionUpdate).toHaveBeenNthCalledWith(1, {
      where: { id: 1 },
      data: { registered: { decrement: 1 } },
    })
    expect(mockSessionUpdate).toHaveBeenNthCalledWith(2, {
      where: { id: 1 },
      data: { registered: { increment: 1 } },
    })
  })

  it('still returns a successful cancellation response when notifyEmployee would reject', async () => {
    mockRegistrationFindUnique.mockResolvedValue({
      id: 1,
      status: 'confirmed',
      trainingSessionId: 1,
    })
    mockRegistrationUpdateMany
      .mockResolvedValueOnce({ count: 1 }) // cancellation
      .mockResolvedValueOnce({ count: 1 }) // promotion
    mockSessionUpdate.mockResolvedValue({ id: 1 })
    mockRegistrationFindFirst.mockResolvedValue({
      id: 5,
      status: 'waitlisted',
      name: 'Waitlisted Employee',
      email: 'waitlisted@example.com',
      trainingSessionId: 1,
    })
    mockFindUnique.mockResolvedValue({ ...mockSession, id: 1 })
    mockNotifyEmployee.mockRejectedValueOnce(new Error('notification failed'))

    const result = await cancelRegistration(1, 1)

    expect(result).toEqual({ status: 'cancelled', promotedRegistrationId: 5 })
  })

  it('returns already_cancelled when a concurrent request already cancelled the confirmed registration', async () => {
    mockRegistrationFindUnique.mockResolvedValue({
      id: 1,
      status: 'confirmed',
      trainingSessionId: 1,
    })
    mockRegistrationUpdateMany.mockResolvedValue({ count: 0 })

    const result = await cancelRegistration(1, 1)

    expect(result).toEqual({ status: 'already_cancelled' })
    expect(mockSessionUpdate).not.toHaveBeenCalled()
  })

  it('cancels a waitlisted registration without decrementing registered or promoting', async () => {
    mockRegistrationFindUnique.mockResolvedValue({
      id: 2,
      status: 'waitlisted',
      trainingSessionId: 1,
    })
    mockRegistrationUpdateMany.mockResolvedValue({ count: 1 })

    const result = await cancelRegistration(1, 2)

    expect(result).toEqual({ status: 'cancelled', promotedRegistrationId: null })
    expect(mockRegistrationUpdateMany).toHaveBeenCalledWith({
      where: { id: 2, status: 'waitlisted' },
      data: { status: 'cancelled' },
    })
    expect(mockSessionUpdate).not.toHaveBeenCalled()
    expect(mockRegistrationFindFirst).not.toHaveBeenCalled()
  })

  it('returns already_cancelled when a concurrent request already cancelled the waitlisted registration', async () => {
    mockRegistrationFindUnique.mockResolvedValue({
      id: 2,
      status: 'waitlisted',
      trainingSessionId: 1,
    })
    mockRegistrationUpdateMany.mockResolvedValue({ count: 0 })

    const result = await cancelRegistration(1, 2)

    expect(result).toEqual({ status: 'already_cancelled' })
  })
})

describe('promoteFromWaitlist', () => {
  beforeEach(() => {
    mockTransaction.mockImplementation((callback: (tx: typeof prisma) => unknown) =>
      callback(prisma)
    )
  })

  it('returns null when there is no one on the waitlist', async () => {
    mockRegistrationFindFirst.mockResolvedValue(null)

    const result = await promoteFromWaitlist(prisma, 1)

    expect(result).toBeNull()
    expect(mockRegistrationUpdateMany).not.toHaveBeenCalled()
    expect(mockSessionUpdate).not.toHaveBeenCalled()
  })

  it('does not notify when there is no one on the waitlist', async () => {
    mockRegistrationFindFirst.mockResolvedValue(null)

    await promoteFromWaitlist(prisma, 1)

    expect(mockNotifyEmployee).not.toHaveBeenCalled()
  })

  it('returns null without throwing when a concurrent transaction already promoted the candidate', async () => {
    mockRegistrationFindFirst.mockResolvedValue({ id: 5, status: 'waitlisted' })
    mockRegistrationUpdateMany.mockResolvedValue({ count: 0 })

    const result = await promoteFromWaitlist(prisma, 1)

    expect(result).toBeNull()
    expect(mockSessionUpdate).not.toHaveBeenCalled()
  })

  it('does not notify when a concurrent transaction already promoted the candidate (0 rows affected)', async () => {
    mockRegistrationFindFirst.mockResolvedValue({ id: 5, status: 'waitlisted' })
    mockRegistrationUpdateMany.mockResolvedValue({ count: 0 })

    await promoteFromWaitlist(prisma, 1)

    expect(mockNotifyEmployee).not.toHaveBeenCalled()
  })

  it('promotes the oldest waitlisted registration and increments registered', async () => {
    mockRegistrationFindFirst.mockResolvedValue({ id: 5, status: 'waitlisted' })
    mockRegistrationUpdateMany.mockResolvedValue({ count: 1 })
    mockSessionUpdate.mockResolvedValue({ id: 1 })

    const result = await promoteFromWaitlist(prisma, 1)

    expect(result).toBe(5)
    expect(mockRegistrationFindFirst).toHaveBeenCalledWith({
      where: { trainingSessionId: 1, status: 'waitlisted' },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    })
    expect(mockRegistrationUpdateMany).toHaveBeenCalledWith({
      where: { id: 5, status: 'waitlisted' },
      data: { status: 'confirmed' },
    })
    expect(mockSessionUpdate).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { registered: { increment: 1 } },
    })
  })

  it('notifies the promoted employee with status "promoted" and the session title/name/email', async () => {
    mockRegistrationFindFirst.mockResolvedValue({
      id: 5,
      status: 'waitlisted',
      name: 'Waitlisted Employee',
      email: 'waitlisted@example.com',
      trainingSessionId: 1,
    })
    mockRegistrationUpdateMany.mockResolvedValue({ count: 1 })
    mockSessionUpdate.mockResolvedValue({ id: 1 })
    mockFindUnique.mockResolvedValue({
      ...mockSession,
      id: 1,
      title: 'TDD in Agentic Development Loop',
      date: new Date('2026-07-01T09:00:00Z'),
    })

    await promoteFromWaitlist(prisma, 1)

    expect(mockNotifyEmployee).toHaveBeenCalledTimes(1)
    expect(mockNotifyEmployee).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Waitlisted Employee',
        email: 'waitlisted@example.com',
        sessionTitle: 'TDD in Agentic Development Loop',
        status: 'promoted',
      })
    )
  })
})

describe('getRegistrationsForSession', () => {
  it('returns not_found when the session does not exist', async () => {
    mockFindUnique.mockResolvedValue(null)

    const result = await getRegistrationsForSession(999)

    expect(result).toEqual({ status: 'not_found' })
    expect(mockRegistrationFindMany).not.toHaveBeenCalled()
  })

  it('returns empty confirmed and waitlisted arrays when there are no registrations', async () => {
    mockFindUnique.mockResolvedValue(mockSession)
    mockRegistrationFindMany.mockResolvedValue([])

    const result = await getRegistrationsForSession(1)

    expect(result).toEqual({ status: 'ok', confirmed: [], waitlisted: [] })
  })

  it('splits registrations into confirmed and waitlisted, excluding cancelled', async () => {
    mockFindUnique.mockResolvedValue(mockSession)
    mockRegistrationFindMany.mockResolvedValue([
      {
        id: 1,
        name: 'Alice',
        email: 'alice@example.com',
        status: 'confirmed',
        createdAt: new Date(),
      },
      { id: 2, name: 'Bob', email: 'bob@example.com', status: 'waitlisted', createdAt: new Date() },
    ])

    const result = await getRegistrationsForSession(1)

    expect(result).toEqual({
      status: 'ok',
      confirmed: [expect.objectContaining({ id: 1, status: 'confirmed' })],
      waitlisted: [expect.objectContaining({ id: 2, status: 'waitlisted' })],
    })
    expect(mockRegistrationFindMany).toHaveBeenCalledWith({
      where: { trainingSessionId: 1, status: { not: 'cancelled' } },
      orderBy: { createdAt: 'asc' },
    })
  })
})
