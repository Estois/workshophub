import request from 'supertest'
import app from '../../src/app'

describe('GET /api/training-sessions', () => {
  it('returns 200 with an array of sessions', async () => {
    const response = await request(app).get('/api/training-sessions')
    expect(response.status).toBe(200)
    expect(Array.isArray(response.body)).toBe(true)
  })

  it('returns sessions with expected fields', async () => {
    const response = await request(app).get('/api/training-sessions')
    expect(response.status).toBe(200)
    if (response.body.length > 0) {
      const session = response.body[0]
      expect(session).toHaveProperty('id')
      expect(session).toHaveProperty('title')
      expect(session).toHaveProperty('description')
      expect(session).toHaveProperty('date')
      expect(session).toHaveProperty('capacity')
      expect(session).toHaveProperty('registered')
      expect(session).toHaveProperty('location')
      expect(session).toHaveProperty('deliveryMode')
      expect(session).toHaveProperty('status')
    }
  })
})

describe('GET /api/training-sessions/:id', () => {
  it('returns 200 with a session when id exists', async () => {
    const allResponse = await request(app).get('/api/training-sessions')
    expect(allResponse.status).toBe(200)
    expect(allResponse.body.length).toBeGreaterThan(0)

    const firstId = allResponse.body[0].id
    const response = await request(app).get(`/api/training-sessions/${firstId}`)
    expect(response.status).toBe(200)
    expect(response.body.id).toBe(firstId)
  })

  it('returns 404 when session does not exist', async () => {
    const response = await request(app).get('/api/training-sessions/999999')
    expect(response.status).toBe(404)
    expect(response.body.error).toBeDefined()
  })

  it('returns 400 for invalid id', async () => {
    const response = await request(app).get('/api/training-sessions/not-a-number')
    expect(response.status).toBe(400)
  })
})
