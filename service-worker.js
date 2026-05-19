const CACHE_NAME = 'muzi-kalender-v1.1';
const ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './apple-touch-icon.png'
];

// Install event: cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        }).then(() => self.skipWaiting())
    );
});

// Activate event: clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event: network first or cache fallback, with Google API exclusion
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // CRITICAL: Do not intercept Google API, OAuth, or external accounts requests
    // Exclude Calendar API and Google Identity Services specifically.
    // Allow caching of Google Fonts.
    const isGoogleApi = url.origin.includes('googleapis.com') && !url.origin.includes('fonts.googleapis.com');
    const isGoogleAuth = url.origin.includes('accounts.google.com') || url.origin.includes('googleusercontent.com') || (url.origin.includes('google.com') && !url.origin.includes('fonts.gstatic.com'));

    if (isGoogleApi || isGoogleAuth) {
        // Return without calling event.respondWith: browser handles it directly from network
        return;
    }

    // Only handle GET requests for caching
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                // If response is valid, clone and update cache
                if (response && response.status === 200 && response.type === 'basic') {
                    const responseClone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseClone);
                    });
                }
                return response;
            })
            .catch(() => {
                // Fallback to cache if network fails
                return caches.match(event.request);
            })
    );
});
