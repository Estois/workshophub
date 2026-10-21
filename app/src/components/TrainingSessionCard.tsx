import type { TrainingSession } from '../types'
import './TrainingSessionCard.css'

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
  const spotsLeft = session.capacity - session.registered
  const isFull = spotsLeft <= 0
  const isAlmostFull = !isFull && spotsLeft <= 3
  const percentFull = Math.min(100, (session.registered / session.capacity) * 100)

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
    </article>
  )
}

export default TrainingSessionCard
