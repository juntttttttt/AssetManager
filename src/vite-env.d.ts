/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    platform?: string
    minimize?: () => void
    maximize?: () => void
    close?: () => void
  }
}

