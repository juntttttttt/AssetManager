// Desktop notifications utility
export function requestNotificationPermission(): Promise<NotificationPermission> {
  return Notification.requestPermission()
}

export function showNotification(title: string, options?: NotificationOptions) {
  if (Notification.permission === 'granted') {
    new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options,
    })
  }
}

export function checkNotificationPermission(): NotificationPermission {
  return Notification.permission
}

