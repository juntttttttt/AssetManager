import initSqlJs, { Database } from 'sql.js'
import fs from 'fs'
import path from 'path'
import bcrypt from 'bcryptjs'

let db: Database | null = null
let SQL: any = null

// Get database path
const getDbPath = (): string => {
  // In production (packaged app), use app data directory
  if (process.env.NODE_ENV === 'production') {
    const appDataPath = process.env.APPDATA || 
      (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config')
    const dbDir = path.join(appDataPath, 'roblox-uploader')
    
    // Create directory if it doesn't exist
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true })
    }
    
    return path.join(dbDir, 'database.db')
  }
  
  // In development, use server directory
  return path.join(__dirname, '..', 'database.db')
}

// Initialize database
export const initializeDatabase = async () => {
  // Initialize sql.js
  SQL = await initSqlJs({
    locateFile: (file: string) => {
      // For Node.js, we need to find the sql-wasm.wasm file
      // It's usually in node_modules/sql.js/dist/
      const wasmPath = path.join(__dirname, '..', 'node_modules', 'sql.js', 'dist', file)
      if (fs.existsSync(wasmPath)) {
        return wasmPath
      }
      return file
    }
  })

  const dbPath = getDbPath()
  let dbData: Buffer | null = null

  // Load existing database if it exists
  if (fs.existsSync(dbPath)) {
    dbData = fs.readFileSync(dbPath)
    db = new SQL.Database(dbData)
  } else {
    // Create new database
    db = new SQL.Database()
  }

  // Initialize tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('owner', 'member')),
      createdAt TEXT DEFAULT (datetime('now')),
      lastLogin TEXT
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt TEXT DEFAULT (datetime('now'))
    )
  `)

  // Create indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)`)
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`)

  // Save database
  saveDatabase()

  console.log('✅ Database initialized')
}

// Save database to file
const saveDatabase = () => {
  if (!db) return
  
  const dbPath = getDbPath()
  const data = db.export()
  const buffer = Buffer.from(data)
  fs.writeFileSync(dbPath, buffer)
}

// Get database instance
export const getDb = (): Database => {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.')
  }
  return db
}

// Save database (call after modifications)
export const saveDb = () => {
  saveDatabase()
}

// Initialize owner account if it doesn't exist
export const initializeOwner = async () => {
  if (!db) {
    await initializeDatabase()
  }

  const stmt = db!.prepare('SELECT id FROM users WHERE role = ?')
  stmt.bind(['owner'])
  const result = stmt.getAsObject()
  stmt.free()
  
  if (!result || Object.keys(result).length === 0) {
    const initialUsername = process.env.INITIAL_OWNER_USERNAME || 'owner'
    const initialPassword = process.env.INITIAL_OWNER_PASSWORD || 'changeme123'
    
    // Hash password
    const salt = await bcrypt.genSalt(10)
    const hashedPassword = await bcrypt.hash(initialPassword, salt)
    
    const insertStmt = db!.prepare(`INSERT INTO users (username, password, role, createdAt) VALUES (?, ?, 'owner', datetime('now'))`)
    insertStmt.bind([initialUsername, hashedPassword])
    insertStmt.step()
    insertStmt.free()
    
    saveDatabase()
    
    console.log(`✅ Initial owner account created: ${initialUsername}`)
    console.log(`⚠️  Please change the default password immediately!`)
  } else {
    console.log('✅ Owner account already exists')
  }
}

// Close database connection
export const closeDatabase = () => {
  if (db) {
    saveDatabase()
    db.close()
    db = null
  }
  console.log('👋 Database connection closed')
}
