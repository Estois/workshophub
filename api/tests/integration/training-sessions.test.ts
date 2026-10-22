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
  it('returns 201 and increments registered when the session has space', async () => {
    const allResponse = await request(app).get('/api/training-sessions')
    const session = allResponse.body.find(
      (s: { capacity: number; registered: number }) => s.registered < s.capacity
    )
    expect(session).toBeDefined()

    const response = await request(app)
      .post(`/api/training-sessions/${session.id}/registrations`)
      .send({ name: 'Alice', email: 'alice@example.com' })

    expect(response.status).toBe(201)
    expect(response.body.status).toBe('confirmed')

    const updated = await request(app).get(`/api/training-sessions/${session.id}`)
    expect(updated.body.registered).toBe(session.registered + 1)
  })

  it('returns 400 when name or email is missing', async () => {
    const allResponse = await request(app).get('/api/training-sessions')
    const sessionId = allResponse.body[0].id

    const response = await request(app)
      .post(`/api/training-sessions/${sessionId}/registrations`)
      .send({ name: 'Alice' })

    expect(response.status).toBe(400)
    expect(response.body.error).toBeDefined()
  })

  it('returns 404 when the session does not exist', async () => {
    const response = await request(app)
      .post('/api/training-sessions/999999/registrations')
      .send({ name: 'Alice', email: 'alice@example.com' })

    expect(response.status).toBe(404)
    expect(response.body.error).toBeDefined()
  })

  it('returns 202 with waitlist position when the session is full', async () => {
    const allResponse = await request(app).get('/api/training-sessions')
    const session = allResponse.body.find(
      (s: { capacity: number; registered: number }) => s.registered < s.capacity
    )
    expect(session).toBeDefined()

    const spotsLeft = session.capacity - session.registered
    for (let i = 0; i < spotsLeft; i++) {
      const fillResponse = await request(app)
        .post(`/api/training-sessions/${session.id}/registrations`)
        .send({ name: `Filler ${i}`, email: `filler${i}@example.com` })
      expect(fillResponse.status).toBe(201)
    }

    const waitlistResponse = await request(app)
      .post(`/api/training-sessions/${session.id}/registrations`)
      .send({ name: 'Waitlisted Employee', email: 'waitlisted@example.com' })

    expect(waitlistResponse.status).toBe(202)
    expect(waitlistResponse.body.status).toBe('waitlisted')
    expect(waitlistResponse.body.position).toBe(1)
  })
})

describe('DELETE /api/training-sessions/:id/registrations/:registrationId', () => {
  it('returns 200 and decrements registered when cancelling a confirmed registration', async () => {
    const allResponse = await request(app).get('/api/training-sessions')
    const session = allResponse.body.find(
      (s: { capacity: number; registered: number }) => s.registered < s.capacity
    )
    expect(session).toBeDefined()

    const registerResponse = await request(app)
      .post(`/api/training-sessions/${session.id}/registrations`)
      .send({ name: 'Cancel Me', email: 'cancelme@example.com' })
    expect(registerResponse.status).toBe(201)

    const response = await request(app).delete(
      `/api/training-sessions/${session.id}/registrations/${registerResponse.body.id}`
    )

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'cancelled', promotedRegistrationId: null })

    const updated = await request(app).get(`/api/training-sessions/${session.id}`)
    expect(updated.body.registered).toBe(session.registered)
  })

  it('promotes the oldest waitlisted employee when cancelling a confirmed registration', async () => {
    const allResponse = await request(app).get('/api/training-sessions')
    const session = allResponse.body.find(
      (s: { capacity: number; registered: number }) => s.registered < s.capacity
    )
    expect(session).toBeDefined()

    const registerResponse = await request(app)
      .post(`/api/training-sessions/${session.id}/registrations`)
      .send({ name: 'Cancel Me', email: 'cancelme-promote@example.com' })
    expect(registerResponse.status).toBe(201)

    const spotsLeft = session.capacity - session.registered - 1
    for (let i = 0; i < spotsLeft; i++) {
      await request(app)
        .post(`/api/training-sessions/${session.id}/registrations`)
        .send({ name: `Filler ${i}`, email: `filler-promote${i}@example.com` })
    }

    const waitlistResponse = await request(app)
      .post(`/api/training-sessions/${session.id}/registrations`)
      .send({ name: 'Waitlisted Employee', email: 'waitlisted-promote@example.com' })
    expect(waitlistResponse.status).toBe(202)

    const beforeCancel = await request(app).get(`/api/training-sessions/${session.id}`)

    const response = await request(app).delete(
      `/api/training-sessions/${session.id}/registrations/${registerResponse.body.id}`
    )

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      status: 'cancelled',
      promotedRegistrationId: waitlistResponse.body.id,
    })

    const afterCancel = await request(app).get(`/api/training-sessions/${session.id}`)
    expect(afterCancel.body.registered).toBe(beforeCancel.body.registered)
  })

  it('returns 409 when cancelling an already cancelled registration', async () => {
    const allResponse = await request(app).get('/api/training-sessions')
    const session = allResponse.body.find(
      (s: { capacity: number; registered: number }) => s.registered < s.capacity
    )
    expect(session).toBeDefined()

    const registerResponse = await request(app)
      .post(`/api/training-sessions/${session.id}/registrations`)
      .send({ name: 'Double Cancel', email: 'doublecancel@example.com' })

    await request(app).delete(
      `/api/training-sessions/${session.id}/registrations/${registerResponse.body.id}`
    )
    const response = await request(app).delete(
      `/api/training-sessions/${session.id}/registrations/${registerResponse.body.id}`
    )

    expect(response.status).toBe(409)
    expect(response.body.error).toBeDefined()
  })

  it('returns 404 when the registration does not exist', async () => {
    const allResponse = await request(app).get('/api/training-sessions')
    const sessionId = allResponse.body[0].id

    const response = await request(app).delete(
      `/api/training-sessions/${sessionId}/registrations/999999`
    )

    expect(response.status).toBe(404)
    expect(response.body.error).toBeDefined()
  })

  it('returns 404 when the registration belongs to a different session', async () => {
    const allResponse = await request(app).get('/api/training-sessions')
    const sessions = allResponse.body.filter(
      (s: { capacity: number; registered: number }) => s.registered < s.capacity
    )
    expect(sessions.length).toBeGreaterThanOrEqual(2)

    const registerResponse = await request(app)
      .post(`/api/training-sessions/${sessions[0].id}/registrations`)
      .send({ name: 'Wrong Session', email: 'wrongsession@example.com' })

    const response = await request(app).delete(
      `/api/training-sessions/${sessions[1].id}/registrations/${registerResponse.body.id}`
    )

    expect(response.status).toBe(404)
    expect(response.body.error).toBeDefined()
  })

  it('returns 400 for an invalid session ID', async () => {
    const response = await request(app).delete(
      '/api/training-sessions/not-a-number/registrations/1'
    )

    expect(response.status).toBe(400)
  })

  it('returns 400 for an invalid registration ID', async () => {
    const allResponse = await request(app).get('/api/training-sessions')
    const sessionId = allResponse.body[0].id

    const response = await request(app).delete(
      `/api/training-sessions/${sessionId}/registrations/not-a-number`
    )

    expect(response.status).toBe(400)
  })

  it('cancels a waitlisted registration without decrementing registered', async () => {
    const allResponse = await request(app).get('/api/training-sessions')
    const session = allResponse.body.find(
      (s: { capacity: number; registered: number }) => s.registered < s.capacity
    )
    expect(session).toBeDefined()

    const spotsLeft = session.capacity - session.registered
    for (let i = 0; i < spotsLeft; i++) {
      await request(app)
        .post(`/api/training-sessions/${session.id}/registrations`)
        .send({ name: `Filler ${i}`, email: `filler${i}@example.com` })
    }

    const waitlistResponse = await request(app)
      .post(`/api/training-sessions/${session.id}/registrations`)
      .send({ name: 'Waitlist Cancel', email: 'waitlistcancel@example.com' })
    expect(waitlistResponse.status).toBe(202)

    const beforeCancel = await request(app).get(`/api/training-sessions/${session.id}`)

    const response = await request(app).delete(
      `/api/training-sessions/${session.id}/registrations/${waitlistResponse.body.id}`
    )

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'cancelled', promotedRegistrationId: null })

    const afterCancel = await request(app).get(`/api/training-sessions/${session.id}`)
    expect(afterCancel.body.registered).toBe(beforeCancel.body.registered)
  })
})

describe('GET /api/training-sessions/:id/registrations', () => {
  it('returns 200 with confirmed and waitlisted arrays', async () => {
    const allResponse = await request(app).get('/api/training-sessions')
    const session = allResponse.body.find(
      (s: { capacity: number; registered: number }) => s.registered < s.capacity
    )
    expect(session).toBeDefined()

    const confirmedResponse = await request(app)
      .post(`/api/training-sessions/${session.id}/registrations`)
      .send({ name: 'Confirmed Attendee', email: 'confirmed-view@example.com' })
    expect(confirmedResponse.status).toBe(201)

    const spotsLeft = session.capacity - session.registered - 1
    for (let i = 0; i < spotsLeft; i++) {
      await request(app)
        .post(`/api/training-sessions/${session.id}/registrations`)
        .send({ name: `Filler View ${i}`, email: `filler-view${i}@example.com` })
    }

    const waitlistResponse = await request(app)
      .post(`/api/training-sessions/${session.id}/registrations`)
      .send({ name: 'Waitlisted Viewer', email: 'waitlisted-view@example.com' })
    expect(waitlistResponse.status).toBe(202)

    const response = await request(app).get(`/api/training-sessions/${session.id}/registrations`)

    expect(response.status).toBe(200)
    expect(response.body.confirmed).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: confirmedResponse.body.id,
          name: 'Confirmed Attendee',
          email: 'confirmed-view@example.com',
          status: 'confirmed',
        }),
      ])
    )
    expect(response.body.waitlisted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: waitlistResponse.body.id,
          name: 'Waitlisted Viewer',
          email: 'waitlisted-view@example.com',
          status: 'waitlisted',
        }),
      ])
    )
    expect(response.body.confirmed[0]).toHaveProperty('createdAt')
  })

  it('excludes cancelled registrations from the response', async () => {
    const allResponse = await request(app).get('/api/training-sessions')
    const session = allResponse.body.find(
      (s: { capacity: number; registered: number }) => s.registered < s.capacity
    )
    expect(session).toBeDefined()

    const registerResponse = await request(app)
      .post(`/api/training-sessions/${session.id}/registrations`)
      .send({ name: 'Will Cancel', email: 'willcancel-view@example.com' })
    expect(registerResponse.status).toBe(201)

    await request(app).delete(
      `/api/training-sessions/${session.id}/registrations/${registerResponse.body.id}`
    )

    const response = await request(app).get(`/api/training-sessions/${session.id}/registrations`)

    expect(response.status).toBe(200)
    expect(response.body.confirmed).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: registerResponse.body.id })])
    )
    expect(response.body.waitlisted).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: registerResponse.body.id })])
    )
  })

  it('returns 404 for an unknown session', async () => {
    const response = await request(app).get('/api/training-sessions/999999/registrations')

    expect(response.status).toBe(404)
    expect(response.body.error).toBeDefined()
  })

  it('returns 400 for an invalid session ID', async () => {
    const response = await request(app).get('/api/training-sessions/not-a-number/registrations')

    expect(response.status).toBe(400)
  })
})
