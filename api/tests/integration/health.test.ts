import request from 'supertest'
import app from '../../src/app'

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const response = await request(app).get('/health')
    expect(response.status).toBe(200)
    expect(response.body.status).toBe('ok')
  })

  it('includes a timestamp', async () => {
    const response = await request(app).get('/health')
    expect(response.body.timestamp).toBeDefined()
    expect(new Date(response.body.timestamp).toString()).not.toBe('Invalid Date')
  })
})
