// User blacklist management

export interface BlacklistedUser {
  userId: string
  username?: string
  reason: string
  blacklistedBy: string
  blacklistedAt: string
  machineId?: string
}

const BLACKLIST_KEY = 'userBlacklist'

export function getBlacklistedUsers(): BlacklistedUser[] {
  try {
    const stored = localStorage.getItem(BLACKLIST_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

export function isUserBlacklisted(userId: string, machineId?: string): boolean {
  const blacklist = getBlacklistedUsers()
  return blacklist.some(
    (user) => user.userId === userId || (machineId && user.machineId === machineId)
  )
}

export function addToBlacklist(
  userId: string,
  reason: string,
  blacklistedBy: string,
  username?: string,
  machineId?: string
): boolean {
  try {
    const blacklist = getBlacklistedUsers()
    
    // Check if already blacklisted
    if (blacklist.some((u) => u.userId === userId)) {
      return false
    }
    
    const blacklistedUser: BlacklistedUser = {
      userId,
      username,
      reason,
      blacklistedBy,
      blacklistedAt: new Date().toISOString(),
      machineId,
    }
    
    blacklist.push(blacklistedUser)
    localStorage.setItem(BLACKLIST_KEY, JSON.stringify(blacklist))
    return true
  } catch {
    return false
  }
}

export function removeFromBlacklist(userId: string): boolean {
  try {
    const blacklist = getBlacklistedUsers()
    const filtered = blacklist.filter((u) => u.userId !== userId)
    localStorage.setItem(BLACKLIST_KEY, JSON.stringify(filtered))
    return true
  } catch {
    return false
  }
}

export function getBlacklistReason(userId: string, machineId?: string): string | null {
  const blacklist = getBlacklistedUsers()
  const user = blacklist.find(
    (u) => u.userId === userId || (machineId && u.machineId === machineId)
  )
  return user ? user.reason : null
}

