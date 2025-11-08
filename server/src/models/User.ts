import bcrypt from 'bcryptjs'
import { getDb, saveDb } from '../database'

export interface IUser {
  id: number
  username: string
  email?: string | null
  password: string
  role: 'owner' | 'member'
  createdAt: Date
  lastLogin?: Date | null
  comparePassword(candidatePassword: string): Promise<boolean>
}

export class User {
  id: number
  username: string
  email?: string | null
  password: string
  role: 'owner' | 'member'
  createdAt: Date
  lastLogin?: Date | null

  constructor(data: Partial<IUser>) {
    this.id = data.id || 0
    this.username = data.username || ''
    this.email = data.email || null
    this.password = data.password || ''
    this.role = data.role || 'member'
    this.createdAt = data.createdAt || new Date()
    this.lastLogin = data.lastLogin || null
  }

  async comparePassword(candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password)
  }

  // Static methods for database operations
  static async findOne(query: { username?: string; role?: string; id?: number }): Promise<User | null> {
    const db = getDb()
    let stmt: any = null

    try {
      if (query.id) {
        stmt = db.prepare('SELECT * FROM users WHERE id = ?')
        stmt.bind([query.id])
      } else if (query.username) {
        stmt = db.prepare('SELECT * FROM users WHERE username = ?')
        stmt.bind([query.username])
      } else if (query.role) {
        stmt = db.prepare('SELECT * FROM users WHERE role = ?')
        stmt.bind([query.role])
      } else {
        return null
      }

      // Must call step() before getAsObject()
      if (!stmt.step()) {
        stmt.free()
        return null
      }

      const result = stmt.getAsObject()
      stmt.free()

      if (!result || Object.keys(result).length === 0) return null

      return new User({
        id: result.id as number,
        username: result.username as string,
        email: result.email as string | null,
        password: result.password as string,
        role: result.role as 'owner' | 'member',
        createdAt: new Date(result.createdAt as string),
        lastLogin: result.lastLogin ? new Date(result.lastLogin as string) : null,
      })
    } catch (error) {
      if (stmt) stmt.free()
      return null
    }
  }

  static async findById(id: number): Promise<User | null> {
    return this.findOne({ id })
  }

  static async find(query: { role?: string } = {}): Promise<User[]> {
    const db = getDb()
    let stmt: any = null

    try {
      if (query.role) {
        stmt = db.prepare('SELECT * FROM users WHERE role = ? ORDER BY createdAt DESC')
        stmt.bind([query.role])
      } else {
        stmt = db.prepare('SELECT * FROM users ORDER BY createdAt DESC')
      }

      const users: User[] = []
      while (stmt.step()) {
        const row = stmt.getAsObject()
        users.push(new User({
          id: row.id as number,
          username: row.username as string,
          email: row.email as string | null,
          password: row.password as string,
          role: row.role as 'owner' | 'member',
          createdAt: new Date(row.createdAt as string),
          lastLogin: row.lastLogin ? new Date(row.lastLogin as string) : null,
        }))
      }

      stmt.free()
      return users
    } catch (error) {
      if (stmt) stmt.free()
      return []
    }
  }

  async save(): Promise<User> {
    const db = getDb()

    if (this.id) {
      // Update existing user
      const stmt = db.prepare(
        `UPDATE users SET username = ?, email = ?, password = ?, role = ?, lastLogin = ? WHERE id = ?`
      )
      stmt.bind([
        this.username,
        this.email || null,
        this.password,
        this.role,
        this.lastLogin ? this.lastLogin.toISOString() : null,
        this.id
      ])
      stmt.step()
      stmt.free()
      saveDb()
    } else {
      // Hash password if it's new
      if (this.password && !this.password.startsWith('$2')) {
        const salt = await bcrypt.genSalt(10)
        this.password = await bcrypt.hash(this.password, salt)
      }

      // Check if owner already exists
      if (this.role === 'owner') {
        const existingOwner = await User.findOne({ role: 'owner' })
        if (existingOwner) {
          throw new Error('An owner already exists')
        }
      }

      // Insert new user
      const stmt = db.prepare(
        `INSERT INTO users (username, email, password, role, createdAt) VALUES (?, ?, ?, ?, datetime('now'))`
      )
      stmt.bind([this.username, this.email || null, this.password, this.role])
      stmt.step()
      stmt.free()
      
      // Get the last insert ID
      const idStmt = db.prepare('SELECT last_insert_rowid() as id')
      idStmt.step()
      const result = idStmt.getAsObject()
      idStmt.free()
      
      if (result && result.id) {
        this.id = result.id as number
      }
      
      saveDb()
    }

    return this
  }
}

export default User
