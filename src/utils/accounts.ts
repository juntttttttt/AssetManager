export interface Account {
  id: string
  name: string
  openCloudApiKey: string
  cookie?: string
  universeId?: string
  createdAt: string
  isActive?: boolean
}

const ACCOUNTS_KEY = 'robloxAccounts'
const ACTIVE_ACCOUNT_KEY = 'activeAccountId'

export function getAccounts(): Account[] {
  const stored = localStorage.getItem(ACCOUNTS_KEY)
  return stored ? JSON.parse(stored) : []
}

export function saveAccount(account: Omit<Account, 'id' | 'createdAt'>): Account {
  const accounts = getAccounts()
  const newAccount: Account = {
    ...account,
    id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
    createdAt: new Date().toISOString(),
    isActive: account.isActive ?? false,
  }
  accounts.push(newAccount)
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
  return newAccount
}

export function updateAccount(id: string, updates: Partial<Account>): void {
  const accounts = getAccounts()
  const index = accounts.findIndex((a) => a.id === id)
  if (index !== -1) {
    accounts[index] = { ...accounts[index], ...updates }
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
  }
}

export function deleteAccount(id: string): void {
  const accounts = getAccounts()
  const filtered = accounts.filter((a) => a.id !== id)
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(filtered))
  
  // If deleted account was active, clear active account
  if (getActiveAccountId() === id) {
    localStorage.removeItem(ACTIVE_ACCOUNT_KEY)
  }
}

export function getActiveAccountId(): string | null {
  return localStorage.getItem(ACTIVE_ACCOUNT_KEY)
}

export function setActiveAccount(id: string | null): void {
  if (id) {
    localStorage.setItem(ACTIVE_ACCOUNT_KEY, id)
    // Update all accounts to set isActive
    const accounts = getAccounts()
    accounts.forEach((account) => {
      account.isActive = account.id === id
    })
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts))
  } else {
    localStorage.removeItem(ACTIVE_ACCOUNT_KEY)
  }
}

export function getActiveAccount(): Account | null {
  const activeId = getActiveAccountId()
  if (!activeId) return null
  
  const accounts = getAccounts()
  return accounts.find((a) => a.id === activeId) || null
}

