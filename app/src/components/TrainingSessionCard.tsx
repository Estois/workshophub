import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { TrainingSession, Registration } from '../types'
import './TrainingSessionCard.css'

interface Props {
  session: TrainingSession
  onCancelled: () => void
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

function TrainingSessionCard({ session, onCancelled }: Props) {
  const spotsLeft = session.capacity - session.registered
  const isFull = spotsLeft <= 0
  const isAlmostFull = !isFull && spotsLeft <= 3
  const percentFull = Math.min(100, (session.registered / session.capacity) * 100)

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [result, setResult] = useState<Registration | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cancelled, setCancelled] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  function handleBack() {
    setShowForm(false)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const response = await fetch(`/api/training-sessions/${session.id}/registrations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email }),
    })
    const body = await response.json()

    if (response.status === 201 || response.status === 202) {
      setResult(body as Registration)
    } else {
      setError(body.error ?? 'Registration failed')
    }
  }

  async function handleCancel() {
    if (!result || cancelled) return

    const confirmed = window.confirm(
      `Are you sure you want to cancel your registration for ${session.title}?`
    )
    if (!confirmed) return

    const response = await fetch(
      `/api/training-sessions/${session.id}/registrations/${result.id}`,
      {
        method: 'DELETE',
      }
    )

    if (response.status === 200) {
      setCancelled(true)
      setCancelError(null)
      onCancelled()
    } else {
      const body = await response.json()
      setCancelError(body.error ?? 'Cancellation failed')
    }
  }

  return (
    <article className={`session-card ${isFull ? 'session-card--full' : ''}`}>
      <div className="session-card__header">
        <span className={`session-badge session-badge--${session.deliveryMode}`}>
          {deliveryModeLabel(session.deliveryMode)}
        </span>
        {isFull && <span className="session-badge session-badge--full">Full</span>}
        {isAlmostFull && (
          <span className="session-badge session-badge--full">Only {spotsLeft} spots left!</span>
        )}
        {session.waitlistCount > 0 && (
          <span className="session-badge session-badge--full">
            {session.waitlistCount} on waitlist
          </span>
        )}
      </div>

      <h3 className="session-card__title">{session.title}</h3>
      <p className="session-card__description">{session.description}</p>

      <Link to={`/sessions/${session.id}`} className="session-card__view-registrations-link">
        View Registrations
      </Link>

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
          <div
            className="capacity-bar"
            role="progressbar"
            aria-valuenow={session.registered}
            aria-valuemin={0}
            aria-valuemax={session.capacity}
          >
            <div className="capacity-bar__fill" style={{ width: `${percentFull}%` }} />
            <span className="capacity-bar__label">
              {session.registered}/{session.capacity}
            </span>
          </div>
        </div>
      </div>

      {result ? (
        <>
          <p className="session-card__registration-message">
            {cancelled
              ? 'Your registration has been cancelled'
              : result.status === 'confirmed'
                ? "You're registered!"
                : `You're on the waitlist, position ${result.position}`}
          </p>
          {!cancelled && (
            <button className="session-card__cancel-button" onClick={handleCancel}>
              Cancel Registration
            </button>
          )}
          {cancelError && <p className="session-card__registration-error">{cancelError}</p>}
        </>
      ) : showForm ? (
        <form className="session-card__registration-form" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          {error && <p className="session-card__registration-error">{error}</p>}
          <div className="session-card__registration-form-actions">
            <button type="button" className="session-card__back-button" onClick={handleBack}>
              Back
            </button>
            <button type="submit">{isFull ? 'Join Waitlist' : 'Register'}</button>
          </div>
        </form>
      ) : (
        <button className="session-card__register-button" onClick={() => setShowForm(true)}>
          {isFull ? 'Join Waitlist' : 'Register'}
        </button>
      )}
    </article>
  )
}

export default TrainingSessionCard
