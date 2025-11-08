import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import User, { IUser } from '../models/User'

export interface AuthRequest extends Request {
  user?: IUser
}

export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = (req as any).headers?.authorization || (req as any).get?.('Authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      res.status(401).json({ error: 'No token provided. Access denied.' })
      return
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret') as { userId: string }
    const user = await User.findById(parseInt(decoded.userId))

    if (!user) {
      res.status(401).json({ error: 'User not found. Access denied.' })
      return
    }

    req.user = user
    next()
  } catch (error) {
    res.status(401).json({ error: 'Invalid token. Access denied.' })
  }
}

export const requireOwner = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' })
    return
  }

  if (req.user.role !== 'owner') {
    res.status(403).json({ error: 'Owner access required' })
    return
  }

  next()
}

