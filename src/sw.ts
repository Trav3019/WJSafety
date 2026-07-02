/// <reference lib="webworker" />
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope

precacheAndRoute(self.__WB_MANIFEST)

// Serve index.html for all page navigations so SPA routing works offline
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html')))

self.addEventListener('push', (event) => {
  let data: { title?: string; body?: string } = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    data = { title: 'WJ Safety', body: event.data?.text() }
  }

  event.waitUntil(
    self.registration.showNotification(data.title ?? 'WJ Safety', {
      body: data.body ?? '',
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      if (clients.length > 0) {
        return clients[0].focus()
      }
      return self.clients.openWindow('/')
    }),
  )
})

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', () => {
  self.clients.claim()
})
