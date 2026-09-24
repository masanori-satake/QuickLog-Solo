import '../../app/js/app.js';

/** Register the PWA worker once the page has loaded over HTTP or HTTPS. */
function registerServiceWorker() {
    navigator.serviceWorker
        .register('./sw.js')
        .then((reg) => {
            console.log('QuickLog-Solo PWA ServiceWorker registered:', reg.scope);
        })
        .catch((err) => {
            console.warn('QuickLog-Solo PWA ServiceWorker registration failed:', err);
        });
}

if ('serviceWorker' in navigator && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
    window.addEventListener('load', registerServiceWorker);
}
