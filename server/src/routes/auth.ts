import express, { Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import User from '../models/User'
import Settings from '../models/Settings'
import { authenticate, AuthRequest } from '../middleware/auth'

const router = express.Router()

// Generate JWT token
const generateToken = (userId: string): string => {
  return jwt.sign(
    { userId },
    process.env.JWT_SECRET || 'fallback-secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  )
}

// Helper function to check if registration is enabled
const isRegistrationEnabled = async (): Promise<boolean> => {
  try {
    const settings = await Settings.findOne({ key: 'registrationEnabled' })
    if (settings) {
      return settings.value === true
    }
    // Fallback to environment variable
    return process.env.REGISTRATION_ENABLED === 'true'
  } catch (error) {
    // Fallback to environment variable on error
    return process.env.REGISTRATION_ENABLED === 'true'
  }
}

// Register new user
router.post('/register', async (req: Request, res: Response) => {
  try {
    // Check if registration is enabled
    const registrationEnabled = await isRegistrationEnabled()
    if (!registrationEnabled) {
      return res.status(403).json({ error: 'Registration is currently disabled' })
    }

    const { username, email, password } = req.body

    // Validation
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' })
    }

    if (username.length < 3 || username.length > 30) {
      return res.status(400).json({ error: 'Username must be between 3 and 30 characters' })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' })
    }

    // Check if user already exists
    const existingUser = await User.findOne({ username })
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' })
    }

    // Check if owner already exists (only first user can be owner)
    const ownerExists = await User.findOne({ role: 'owner' })
    const role = ownerExists ? 'member' : 'owner'

    // Create new user
    const user = new User({
      username,
      email,
      password,
      role,
    })

    await user.save()

    // Generate token
    const token = generateToken(user.id.toString())

    // Update last login
    user.lastLogin = new Date()
    await user.save()

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error: any) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Username already exists' })
    }
    res.status(500).json({ error: error.message || 'Server error' })
  }
})

// Login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' })
    }

    // Find user
    const user = await User.findOne({ username })
    if (!user) {
      console.log(`[Login] User not found: ${username}`)
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    console.log(`[Login] Attempting login for user: ${user.username} (ID: ${user.id}, Role: ${user.role})`)

    // Check password
    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      console.log(`[Login] Password mismatch for user: ${username}`)
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    console.log(`[Login] Password verified for user: ${username}`)

    // Generate token
    const token = generateToken(user.id.toString())

    // Update last login
    user.lastLogin = new Date()
    await user.save()

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Server error' })
  }
})

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    // Create user object without password
    const { password, ...userWithoutPassword } = user
    res.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Server error' })
  }
})

// Check if registration is enabled
router.get('/registration-status', async (req: Request, res: Response) => {
  try {
    const registrationEnabled = await isRegistrationEnabled()
    console.log(`[API] Registration status check: ${registrationEnabled}`)
    res.json({
      registrationEnabled,
    })
  } catch (error: any) {
    console.error('[API] Error checking registration status:', error)
    // Default to enabled on error
    res.json({
      registrationEnabled: true,
    })
  }
})

export default router

