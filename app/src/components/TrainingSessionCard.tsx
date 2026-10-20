import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Registration, TrainingSession } from '../types'
import './TrainingSessionCard.css'

const API_BASE = import.meta.env.VITE_API_URL || ''

interface Props {
  session: TrainingSession
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-SG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-SG', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function deliveryModeLabel(mode: string): string {
  const labels: Record<string, string> = {
    'in-person': 'In Person',
    online: 'Online',
    hybrid: 'Hybrid',
  }
  return labels[mode] ?? mode
}

function TrainingSessionCard({ session }: Props) {
  const [registered, setRegistered] = useState(session.registered)
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [confirmed, setConfirmed] = useState<Registration | null>(null)

  const spotsLeft = session.capacity - registered
  const isFull = spotsLeft <= 0
  const fillPercent =
    session.capacity > 0 ? Math.min(100, Math.round((registered / session.capacity) * 100)) : 0

  async function handleRegister(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)

    try {
      const res = await fetch(`${API_BASE}/api/training-sessions/${session.id}/registrations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      })

      const body = await res.json()

      if (res.status === 201) {
        setConfirmed(body as Registration)
        setRegistered((prev) => prev + 1)
        setShowForm(false)
        return
      }

      if (res.status === 409) {
        setFormError('This session just filled up.')
        setRegistered(session.capacity)
        return
      }

      setFormError(body.error || `Registration failed: ${res.status}`)
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <article className={`session-card ${isFull ? 'session-card--full' : ''}`}>
      <div className="session-card__header">
        <span className={`session-badge session-badge--${session.deliveryMode}`}>
          {deliveryModeLabel(session.deliveryMode)}
        </span>
        {isFull && <span className="session-badge session-badge--full">Full</span>}
      </div>

      <h3 className="session-card__title">{session.title}</h3>
      <p className="session-card__description">{session.description}</p>

      <div className="session-card__meta">
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
        <div className="meta-item meta-item--capacity">
          <span className="meta-label">Capacity</span>
          <span className="meta-value">
            {registered} / {session.capacity} registered
          </span>
        </div>
        <div
          className="capacity-bar"
          role="progressbar"
          aria-valuenow={registered}
          aria-valuemin={0}
          aria-valuemax={session.capacity}
          aria-label={`${registered} of ${session.capacity} seats registered`}
        >
          <div
            className={`capacity-bar__fill ${isFull ? 'capacity-bar__fill--full' : ''}`}
            style={{ width: `${fillPercent}%` }}
          />
        </div>
      </div>

      <div className="session-card__register">
        {confirmed && (
          <p className="register-confirmation">
            You&apos;re registered, {confirmed.name}! Confirmation sent to {confirmed.email}.
          </p>
        )}

        {!confirmed && !isFull && !showForm && (
          <button type="button" className="register-button" onClick={() => setShowForm(true)}>
            Register
          </button>
        )}

        {!confirmed && !isFull && showForm && (
          <form className="register-form" onSubmit={handleRegister}>
            <input
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              type="email"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            {formError && <p className="register-error">{formError}</p>}
            <div className="register-form__actions">
              <button type="submit" className="register-button" disabled={submitting}>
                {submitting ? 'Registering...' : 'Confirm registration'}
              </button>
              <button
                type="button"
                className="register-button register-button--cancel"
                onClick={() => setShowForm(false)}
                disabled={submitting}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </article>
  )
}

export default TrainingSessionCard
