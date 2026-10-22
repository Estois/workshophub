import './RegistrationBanner.css'

interface Props {
  message: string
  onDismiss: () => void
}

function RegistrationBanner({ message, onDismiss }: Props) {
  return (
    <div className="registration-banner" role="status">
      <span className="registration-banner__message">{message}</span>
      <button
        type="button"
        className="registration-banner__dismiss"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        ×
      </button>
    </div>
  )
}

export default RegistrationBanner
