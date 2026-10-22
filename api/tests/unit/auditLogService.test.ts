import { getAuditHistory } from '../../src/services/auditLogService'
import prisma from '../../src/lib/prisma'

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    registration: {
      findUnique: jest.fn(),
    },
    auditLog: {
      findMany: jest.fn(),
    },
  },
}))

const mockRegistrationFindUnique = prisma.registration.findUnique as jest.Mock
const mockAuditLogFindMany = prisma.auditLog.findMany as jest.Mock

afterEach(() => {
  jest.clearAllMocks()
})

describe('getAuditHistory', () => {
  it('returns not_found when the registration does not exist', async () => {
    mockRegistrationFindUnique.mockResolvedValue(null)

    const result = await getAuditHistory(1, 999)

    expect(result).toEqual({ status: 'not_found' })
    expect(mockAuditLogFindMany).not.toHaveBeenCalled()
  })

  it('returns not_found when the registration belongs to a different session', async () => {
    mockRegistrationFindUnique.mockResolvedValue({ id: 1, trainingSessionId: 2 })

    const result = await getAuditHistory(1, 1)

    expect(result).toEqual({ status: 'not_found' })
    expect(mockAuditLogFindMany).not.toHaveBeenCalled()
  })

  it('returns the audit history ordered oldest first', async () => {
    mockRegistrationFindUnique.mockResolvedValue({ id: 1, trainingSessionId: 1 })
    const history = [
      {
        id: 1,
        registrationId: 1,
        fromStatus: null,
        toStatus: 'confirmed',
        changedAt: new Date('2026-07-01T00:00:00Z'),
        reason: null,
      },
      {
        id: 2,
        registrationId: 1,
        fromStatus: 'confirmed',
        toStatus: 'cancelled',
        changedAt: new Date('2026-07-02T00:00:00Z'),
        reason: null,
      },
    ]
    mockAuditLogFindMany.mockResolvedValue(history)

    const result = await getAuditHistory(1, 1)

    expect(result).toEqual({ status: 'ok', history })
    expect(mockAuditLogFindMany).toHaveBeenCalledWith({
      where: { registrationId: 1 },
      orderBy: { changedAt: 'asc' },
    })
  })
})
