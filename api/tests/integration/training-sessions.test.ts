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

describe('POST /api/training-sessions/:id/registrations', () => {
  it('returns 201 and increments registered on success', async () => {
    const allResponse = await request(app).get('/api/training-sessions')
    const openSession = allResponse.body.find(
      (s: { registered: number; capacity: number }) => s.registered < s.capacity
    )
    expect(openSession).toBeDefined()

    const response = await request(app)
      .post(`/api/training-sessions/${openSession.id}/registrations`)
      .send({ name: 'Ada Lovelace', email: 'ada@example.com' })

    expect(response.status).toBe(201)
    expect(response.body).toMatchObject({
      name: 'Ada Lovelace',
      email: 'ada@example.com',
      trainingSessionId: openSession.id,
    })

    const afterResponse = await request(app).get(`/api/training-sessions/${openSession.id}`)
    expect(afterResponse.body.registered).toBe(openSession.registered + 1)
  })

  it('returns 400 when name or email is missing', async () => {
    const allResponse = await request(app).get('/api/training-sessions')
    const sessionId = allResponse.body[0].id

    const response = await request(app)
      .post(`/api/training-sessions/${sessionId}/registrations`)
      .send({})

    expect(response.status).toBe(400)
    expect(response.body.error).toBeDefined()
  })

  it('returns 404 when the session does not exist', async () => {
    const response = await request(app)
      .post('/api/training-sessions/999999/registrations')
      .send({ name: 'Ada Lovelace', email: 'ada@example.com' })

    expect(response.status).toBe(404)
  })

  it('returns 409 when the session is full', async () => {
    const allResponse = await request(app).get('/api/training-sessions')
    const sessionId = allResponse.body[0].id
    const session = await request(app).get(`/api/training-sessions/${sessionId}`)
    const spotsLeft = session.body.capacity - session.body.registered

    for (let i = 0; i < spotsLeft; i++) {
      const fillResponse = await request(app)
        .post(`/api/training-sessions/${sessionId}/registrations`)
        .send({ name: `Filler ${i}`, email: `filler${i}@example.com` })
      expect(fillResponse.status).toBe(201)
    }

    const response = await request(app)
      .post(`/api/training-sessions/${sessionId}/registrations`)
      .send({ name: 'One Too Many', email: 'toomany@example.com' })

    expect(response.status).toBe(409)
  })
})
