import 'dotenv/config'
import app from './app'

const PORT = process.env.APP_PORT || 3001

app.listen(PORT, () => {
  console.log(`WorkshopHub API running on port ${PORT}`)
  console.log(`  Health: http://localhost:${PORT}/health`)
  console.log(`  Sessions: http://localhost:${PORT}/api/training-sessions`)
})
