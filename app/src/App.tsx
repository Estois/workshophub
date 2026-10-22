import { BrowserRouter, Routes, Route } from 'react-router-dom'
import TrainingSessionsPage from './pages/TrainingSessionsPage'
import SessionDetailPage from './pages/SessionDetailPage'
import './App.css'

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>WorkshopHub</h1>
        <p className="app-tagline">Internal Training Registration System</p>
      </header>
      <main className="app-main">
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<TrainingSessionsPage />} />
            <Route path="/sessions/:id" element={<SessionDetailPage />} />
          </Routes>
        </BrowserRouter>
      </main>
    </div>
  )
}

export default App
