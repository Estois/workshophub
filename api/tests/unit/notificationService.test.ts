import { notifyEmployee } from '../../src/services/notificationService'

const baseParams = {
  name: 'Alice',
  email: 'alice@example.com',
  sessionTitle: 'TDD in Agentic Development Loop',
  sessionDate: new Date('2026-07-01T09:00:00Z'),
  status: 'confirmed' as const,
}

describe('notifyEmployee', () => {
  const originalWebhook = process.env.SLACK_WEBHOOK_URL
  let consoleLogSpy: jest.SpyInstance
  let consoleErrorSpy: jest.SpyInstance
  let fetchMock: jest.Mock

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined)
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    fetchMock = jest.fn()
    ;(global as unknown as { fetch: jest.Mock }).fetch = fetchMock
  })

  afterEach(() => {
    jest.restoreAllMocks()
    if (originalWebhook === undefined) {
      delete process.env.SLACK_WEBHOOK_URL
    } else {
      process.env.SLACK_WEBHOOK_URL = originalWebhook
    }
  })

  it('logs a line containing name, email, session title, and status', async () => {
    delete process.env.SLACK_WEBHOOK_URL

    await notifyEmployee(baseParams)

    expect(consoleLogSpy).toHaveBeenCalledTimes(1)
    const loggedLine = consoleLogSpy.mock.calls[0].join(' ')
    expect(loggedLine).toContain('Alice')
    expect(loggedLine).toContain('alice@example.com')
    expect(loggedLine).toContain('TDD in Agentic Development Loop')
    expect(loggedLine).toContain('confirmed')
  })

  it('does not call fetch when SLACK_WEBHOOK_URL is not set', async () => {
    delete process.env.SLACK_WEBHOOK_URL

    await notifyEmployee(baseParams)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not call fetch when SLACK_WEBHOOK_URL is an empty string', async () => {
    process.env.SLACK_WEBHOOK_URL = ''

    await notifyEmployee(baseParams)

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('POSTs to SLACK_WEBHOOK_URL with a payload derived from params when set', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.test/services/T000/B000/XXX'
    fetchMock.mockResolvedValue({ ok: true, status: 200 })

    await notifyEmployee(baseParams)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://hooks.slack.test/services/T000/B000/XXX')
    expect(options).toMatchObject({ method: 'POST' })
    const body = JSON.parse(options.body)
    expect(body.text).toContain('Alice')
    expect(body.text).toContain('alice@example.com')
    expect(body.text).toContain('TDD in Agentic Development Loop')
  })

  it('never rejects even when the Slack fetch rejects', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.test/services/T000/B000/XXX'
    fetchMock.mockRejectedValue(new Error('network down'))

    await expect(notifyEmployee(baseParams)).resolves.toBeUndefined()
  })

  it('never rejects even when console.log throws', async () => {
    delete process.env.SLACK_WEBHOOK_URL
    consoleLogSpy.mockImplementation(() => {
      throw new Error('log formatting failure')
    })

    await expect(notifyEmployee(baseParams)).resolves.toBeUndefined()
    expect(consoleErrorSpy).toHaveBeenCalled()
  })

  it('never rejects when Slack responds with a non-2xx status', async () => {
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.test/services/T000/B000/XXX'
    fetchMock.mockResolvedValue({ ok: false, status: 500 })

    await expect(notifyEmployee(baseParams)).resolves.toBeUndefined()
  })
})
