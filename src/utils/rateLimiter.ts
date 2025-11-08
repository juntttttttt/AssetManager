export interface RateLimitConfig {
  maxRequests: number
  windowMs: number
  autoThrottle?: boolean // Automatically wait instead of throwing errors
  minDelay?: number // Minimum delay between requests (ms)
}

export interface RateLimitStatus {
  canMakeRequest: boolean
  waitTime: number
  requestsInWindow: number
  maxRequests: number
  windowMs: number
}

class RateLimiter {
  private requests: Map<string, number[]> = new Map()
  private config: RateLimitConfig
  private queue: Map<string, Array<() => void>> = new Map() // Queue of callbacks waiting for rate limit

  constructor(config: RateLimitConfig = { maxRequests: 10, windowMs: 60000, autoThrottle: true, minDelay: 1000 }) {
    this.config = config
  }

  /**
   * Check if a request can be made immediately
   */
  canMakeRequest(key: string = 'default'): boolean {
    const now = Date.now()
    const requests = this.requests.get(key) || []
    
    // Remove old requests outside the window
    const validRequests = requests.filter((timestamp) => now - timestamp < this.config.windowMs)
    
    if (validRequests.length >= this.config.maxRequests) {
      return false
    }
    
    return true
  }

  /**
   * Get the time until the next request can be made
   */
  getTimeUntilNextRequest(key: string = 'default'): number {
    const now = Date.now()
    const requests = this.requests.get(key) || []
    const validRequests = requests.filter((timestamp) => now - timestamp < this.config.windowMs)
    
    if (validRequests.length < this.config.maxRequests) {
      return 0
    }
    
    const oldestRequest = validRequests[0]
    const waitTime = this.config.windowMs - (now - oldestRequest)
    
    // Also check minimum delay
    if (validRequests.length > 0) {
      const lastRequest = validRequests[validRequests.length - 1]
      const timeSinceLastRequest = now - lastRequest
      const minDelayWait = Math.max(0, (this.config.minDelay || 0) - timeSinceLastRequest)
      return Math.max(waitTime, minDelayWait)
    }
    
    return waitTime
  }

  /**
   * Get current rate limit status
   */
  getStatus(key: string = 'default'): RateLimitStatus {
    const now = Date.now()
    const requests = this.requests.get(key) || []
    const validRequests = requests.filter((timestamp) => now - timestamp < this.config.windowMs)
    
    return {
      canMakeRequest: validRequests.length < this.config.maxRequests,
      waitTime: this.getTimeUntilNextRequest(key),
      requestsInWindow: validRequests.length,
      maxRequests: this.config.maxRequests,
      windowMs: this.config.windowMs,
    }
  }

  /**
   * Record a request (call this after making a request)
   */
  recordRequest(key: string = 'default'): void {
    const now = Date.now()
    const requests = this.requests.get(key) || []
    
    // Remove old requests outside the window
    const validRequests = requests.filter((timestamp) => now - timestamp < this.config.windowMs)
    
    // Add current request
    validRequests.push(now)
    this.requests.set(key, validRequests)
    
    // Process queue if there are waiting callbacks
    this.processQueue(key)
  }

  /**
   * Wait for rate limit to allow a request (automatic throttling)
   */
  async waitForRateLimit(key: string = 'default', onWait?: (waitTime: number) => void): Promise<void> {
    if (this.canMakeRequest(key)) {
      return
    }

    const waitTime = this.getTimeUntilNextRequest(key)
    
    if (waitTime > 0) {
      if (onWait) {
        onWait(waitTime)
      }
      
      // Wait for the rate limit window
      await new Promise((resolve) => {
        setTimeout(() => {
          resolve(undefined)
        }, waitTime)
      })
      
      // Also ensure minimum delay
      if (this.config.minDelay) {
        const requests = this.requests.get(key) || []
        if (requests.length > 0) {
          const lastRequest = requests[requests.length - 1]
          const timeSinceLastRequest = Date.now() - lastRequest
          if (timeSinceLastRequest < this.config.minDelay) {
            await new Promise((resolve) => {
              setTimeout(() => {
                resolve(undefined)
              }, this.config.minDelay! - timeSinceLastRequest)
            })
          }
        }
      }
    }
  }

  /**
   * Execute a function with automatic rate limiting
   */
  async executeWithRateLimit<T>(
    fn: () => Promise<T>,
    key: string = 'default',
    onWait?: (waitTime: number) => void
  ): Promise<T> {
    // Wait for rate limit if needed
    if (this.config.autoThrottle) {
      await this.waitForRateLimit(key, onWait)
    } else if (!this.canMakeRequest(key)) {
      const waitTime = this.getTimeUntilNextRequest(key)
      throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`)
    }

    try {
      const result = await fn()
      // Record the request after successful execution
      this.recordRequest(key)
      return result
    } catch (error) {
      // Only record request on success to avoid consuming rate limit on errors
      throw error
    }
  }

  /**
   * Queue management - add a callback to the queue
   */
  private processQueue(key: string): void {
    const queue = this.queue.get(key) || []
    if (queue.length === 0) {
      return
    }

    if (this.canMakeRequest(key)) {
      const callback = queue.shift()
      if (callback) {
        callback()
        this.processQueue(key) // Process next in queue
      }
    }
  }

  /**
   * Add a request to the queue (for future queue management features)
   */
  enqueue(key: string = 'default', callback: () => void): void {
    if (!this.queue.has(key)) {
      this.queue.set(key, [])
    }
    this.queue.get(key)!.push(callback)
    this.processQueue(key)
  }

  /**
   * Get queue length
   */
  getQueueLength(key: string = 'default'): number {
    return this.queue.get(key)?.length || 0
  }

  /**
   * Clear queue
   */
  clearQueue(key: string = 'default'): void {
    this.queue.delete(key)
  }

  reset(key: string = 'default'): void {
    this.requests.delete(key)
    this.queue.delete(key)
  }

  resetAll(): void {
    this.requests.clear()
    this.queue.clear()
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get current configuration
   */
  getConfig(): RateLimitConfig {
    return { ...this.config }
  }
}

export const rateLimiter = new RateLimiter({
  maxRequests: 10, // 10 requests
  windowMs: 60000, // per minute
  autoThrottle: true, // Automatically wait instead of throwing errors
  minDelay: 2000, // Minimum 2 seconds between requests
})

