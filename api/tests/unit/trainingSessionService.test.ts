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
    },
    $transaction: jest.fn(),
  },
}))

const mockFindMany = prisma.trainingSession.findMany as jest.Mock
const mockFindUnique = prisma.trainingSession.findUnique as jest.Mock
const mockUpdateMany = prisma.trainingSession.updateMany as jest.Mock
const mockRegistrationCreate = prisma.registration.create as jest.Mock
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

afterEach(() => {
  jest.clearAllMocks()
})

describe('getAllSessions', () => {
  it('returns sessions ordered by date', async () => {
    const sessions = [
      mockSession,
      { ...mockSession, id: 2, date: new Date('2026-07-02T09:00:00Z') },
    ]
    mockFindMany.mockResolvedValue(sessions)

    const result = await getAllSessions()

    expect(result).toEqual(sessions)
    expect(mockFindMany).toHaveBeenCalledWith({ orderBy: { date: 'asc' } })
  })

  it('returns an empty array when no sessions exist', async () => {
    mockFindMany.mockResolvedValue([])

    const result = await getAllSessions()

    expect(result).toEqual([])
  })
})

describe('getSessionById', () => {
  it('returns the matching session', async () => {
    mockFindUnique.mockResolvedValue(mockSession)

    const result = await getSessionById(1)

    expect(result).toEqual(mockSession)
    expect(mockFindUnique).toHaveBeenCalledWith({ where: { id: 1 } })
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

  it('creates a registration and increments registered when space is available', async () => {
    mockFindUnique.mockResolvedValue(mockSession)
    mockUpdateMany.mockResolvedValue({ count: 1 })
    const registration = {
      id: 1,
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      trainingSessionId: 1,
      createdAt: new Date('2026-07-01T00:00:00Z'),
    }
    mockRegistrationCreate.mockResolvedValue(registration)

    const result = await registerForSession(1, 'Ada Lovelace', 'ada@example.com')

    expect(result).toEqual({ status: 'created', registration })
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { id: 1, registered: { lt: mockSession.capacity } },
      data: { registered: { increment: 1 } },
    })
    expect(mockRegistrationCreate).toHaveBeenCalledWith({
      data: { name: 'Ada Lovelace', email: 'ada@example.com', trainingSessionId: 1 },
    })
  })

  it('returns not_found when the session does not exist', async () => {
    mockFindUnique.mockResolvedValue(null)

    const result = await registerForSession(999, 'Ada Lovelace', 'ada@example.com')

    expect(result).toEqual({ status: 'not_found' })
    expect(mockUpdateMany).not.toHaveBeenCalled()
  })

  it('returns full when the session has no remaining capacity', async () => {
    mockFindUnique.mockResolvedValue({ ...mockSession, registered: 20 })
    mockUpdateMany.mockResolvedValue({ count: 0 })

    const result = await registerForSession(1, 'Ada Lovelace', 'ada@example.com')

    expect(result).toEqual({ status: 'full' })
    expect(mockRegistrationCreate).not.toHaveBeenCalled()
  })
})
