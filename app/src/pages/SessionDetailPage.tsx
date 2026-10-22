import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { TrainingSession, RegistrationsBySession } from '../types'
import { formatDate } from '../utils/formatDate'
import './SessionDetailPage.css'

const API_BASE = import.meta.env.VITE_API_URL || ''

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-SG', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function SessionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [session, setSession] = useState<TrainingSession | null>(null)
  const [registrations, setRegistrations] = useState<RegistrationsBySession | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    Promise.all([
      fetch(`${API_BASE}/api/training-sessions/${id}`),
      fetch(`${API_BASE}/api/training-sessions/${id}/registrations`),
    ])
      .then(async ([sessionRes, registrationsRes]) => {
        if (sessionRes.status === 404 || registrationsRes.status === 404) {
          throw new Error('Training session not found')
        }
        if (!sessionRes.ok || !registrationsRes.ok) {
          throw new Error(`Server error: ${sessionRes.status || registrationsRes.status}`)
        }

        const sessionData: TrainingSession = await sessionRes.json()
        const registrationsData: RegistrationsBySession = await registrationsRes.json()
        setSession(sessionData)
        setRegistrations(registrationsData)
        setLoading(false)
      })
      .catch((err: Error) => {
        setError(err.message)
        setLoading(false)
      })
  }, [id])

  if (loading) {
    return <div className="page-state">Loading session...</div>
  }

  if (error || !session || !registrations) {
    return (
      <div className="page-state page-state--error">
        <p>Failed to load session.</p>
        <p className="error-detail">{error}</p>
        <Link to="/">Back to sessions</Link>
      </div>
    )
  }

  const hasRegistrations = registrations.confirmed.length > 0 || registrations.waitlisted.length > 0

  return (
    <section className="session-detail">
      <Link to="/" className="session-detail__back-link">
        Back to sessions
      </Link>

      <h2 className="session-detail__title">{session.title}</h2>
      <p className="session-detail__description">{session.description}</p>

      <div className="session-detail__meta">
        <div className="meta-item">
          <span className="meta-label">Date</span>
          <span className="meta-value">{formatDate(session.date)}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Time</span>
          <span className="meta-value">{formatTime(session.date)}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Location</span>
          <span className="meta-value">{session.location}</span>
        </div>
      </div>

      <div className="session-detail__registrations">
        <h3 className="session-detail__registrations-heading">Registrations</h3>

        {!hasRegistrations ? (
          <p className="page-state">No registrations yet</p>
        ) : (
          <>
            <div className="session-detail__registration-group">
              <h4>Confirmed ({registrations.confirmed.length})</h4>
              <ul className="session-detail__registration-list">
                {registrations.confirmed.map((r) => (
                  <li key={r.id}>
                    <span className="session-detail__registrant-name">{r.name}</span>
                    <span className="session-detail__registrant-email">{r.email}</span>
                    <span className="session-detail__registrant-date">
                      {formatDate(r.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="session-detail__registration-group">
              <h4>Waitlist ({registrations.waitlisted.length})</h4>
              <ul className="session-detail__registration-list">
                {registrations.waitlisted.map((r) => (
                  <li key={r.id}>
                    <span className="session-detail__registrant-name">{r.name}</span>
                    <span className="session-detail__registrant-email">{r.email}</span>
                    <span className="session-detail__registrant-date">
                      {formatDate(r.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </div>
    </section>
  )
}

export default SessionDetailPage
