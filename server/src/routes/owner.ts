import express, { Response } from 'express'
import { authenticate, requireOwner, AuthRequest } from '../middleware/auth'
import Settings from '../models/Settings'

const router = express.Router()

// All owner routes require authentication and owner role
router.use(authenticate)
router.use(requireOwner)

// Example owner-only endpoint
router.get('/dashboard', (req: AuthRequest, res: Response) => {
  res.json({
    message: 'Owner dashboard data',
      user: {
        id: req.user!.id,
        username: req.user!.username,
        role: req.user!.role,
      },
  })
})

// Toggle registration
router.post('/toggle-registration', async (req: AuthRequest, res: Response) => {
  try {
    const { enabled } = (req as any).body

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean' })
    }

    // Update or create settings document
    const settings = await Settings.findOneAndUpdate(
      { key: 'registrationEnabled' },
      { key: 'registrationEnabled', value: enabled },
      { upsert: true, new: true }
    )

    res.json({
      message: `Registration ${enabled ? 'enabled' : 'disabled'}`,
      registrationEnabled: enabled,
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Server error' })
  }
})

// Get all users (owner only)
router.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const User = (await import('../models/User')).default
    const allUsers = await User.find()
    
    // Remove passwords from response
    const users = allUsers.map(user => {
      const { password, ...userWithoutPassword } = user
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      }
    })
    
    res.json({ users })
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Server error' })
  }
})

export default router

