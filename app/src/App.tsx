import TrainingSessionsPage from './pages/TrainingSessionsPage'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>WorkshopHub</h1>
        <p className="app-tagline">Internal Training Registration System</p>
      </header>
      <main className="app-main">
        <TrainingSessionsPage />
      </main>
    </div>
  )
}

export default App
