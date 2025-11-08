import { getDb, saveDb } from '../database'

export interface ISettings {
  key: string
  value: any
  updatedAt: Date
}

export class Settings {
  key: string
  value: any
  updatedAt: Date

  constructor(data: ISettings) {
    this.key = data.key
    this.value = data.value
    this.updatedAt = data.updatedAt || new Date()
  }

  static async findOne(query: { key: string }): Promise<Settings | null> {
    const db = getDb()
    let stmt: any = null

    try {
      stmt = db.prepare('SELECT * FROM settings WHERE key = ?')
      stmt.bind([query.key])

      // Must call step() before getAsObject()
      if (!stmt.step()) {
        stmt.free()
        return null
      }

      const result = stmt.getAsObject()
      stmt.free()

      if (!result || Object.keys(result).length === 0) return null

      // Parse JSON value
      let value
      try {
        value = JSON.parse(result.value as string)
      } catch {
        value = result.value
      }

      return new Settings({
        key: result.key as string,
        value,
        updatedAt: new Date(result.updatedAt as string),
      })
    } catch (error) {
      if (stmt) stmt.free()
      return null
    }
  }

  static async findOneAndUpdate(
    query: { key: string },
    update: { key: string; value: any },
    options?: { upsert?: boolean; new?: boolean }
  ): Promise<Settings> {
    const db = getDb()
    const existing = await this.findOne(query)

    const valueStr = typeof update.value === 'string' 
      ? update.value 
      : JSON.stringify(update.value)

    if (existing) {
      // Update existing
      const stmt = db.prepare(
        `UPDATE settings SET value = ?, updatedAt = datetime('now') WHERE key = ?`
      )
      stmt.bind([valueStr, query.key])
      stmt.step()
      stmt.free()
    } else if (options?.upsert) {
      // Insert new
      const stmt = db.prepare(
        `INSERT INTO settings (key, value, updatedAt) VALUES (?, ?, datetime('now'))`
      )
      stmt.bind([update.key, valueStr])
      stmt.step()
      stmt.free()
    }

    saveDb()
    return (await this.findOne({ key: query.key }))!
  }
}

export default Settings
