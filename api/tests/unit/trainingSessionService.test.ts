import {
  getAllSessions,
  getSessionById,
  registerForSession,
} from '../../src/services/trainingSessionService'
import prisma from '../../src/lib/prisma'

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    trainingSession: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    registration: {
      create: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

const mockFindMany = prisma.trainingSession.findMany as jest.Mock
const mockFindUnique = prisma.trainingSession.findUnique as jest.Mock
const mockUpdateMany = prisma.trainingSession.updateMany as jest.Mock
const mockRegistrationCreate = prisma.registration.create as jest.Mock
const mockRegistrationCount = prisma.registration.count as jest.Mock
const mockTransaction = prisma.$transaction as jest.Mock

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
