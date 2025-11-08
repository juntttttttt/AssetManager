import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import authRoutes from './routes/auth'
import ownerRoutes from './routes/owner'
import { initializeDatabase, initializeOwner, closeDatabase } from './database'

// Load environment variables
dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Routes
app.use('/api/auth', authRoutes)
app.use('/api/owner', ownerRoutes)

// Health check
app.get('/api/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'ok', message: 'Server is running' })
})

// Initialize registration setting
const initializeRegistrationSetting = async () => {
  try {
    const Settings = (await import('./models/Settings')).default
    const existing = await Settings.findOne({ key: 'registrationEnabled' })
    
    if (!existing) {
      // Initialize from environment variable or default to true (enabled by default)
      const defaultValue = process.env.REGISTRATION_ENABLED !== 'false'
      await Settings.findOneAndUpdate(
        { key: 'registrationEnabled' },
        { key: 'registrationEnabled', value: defaultValue },
        { upsert: true }
      )
      console.log(`📝 Registration setting initialized: ${defaultValue ? 'enabled' : 'disabled'}`)
    }
  } catch (error) {
    console.error('Failed to initialize registration setting:', error)
  }
}

// Start server
const startServer = async () => {
  try {
    // Initialize SQLite database
    await initializeDatabase()
    
    // Create initial owner if needed
    await initializeOwner()
    
    // Initialize registration setting
    await initializeRegistrationSetting()

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`)
      console.log(`💾 Using SQLite database`)
    })
  } catch (error) {
    console.error('❌ Server startup error:', error)
    process.exit(1)
  }
}

startServer().catch(console.error)

// Graceful shutdown
process.on('SIGINT', () => {
  closeDatabase()
  process.exit(0)
})

