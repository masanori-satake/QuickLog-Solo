import '../../app/js/app.js';

if ('serviceWorker' in navigator && (window.location.protocol === 'http:' || window.location.protocol === 'https:')) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('./sw.js')
            .then((reg) => {
                console.log('QuickLog-Solo PWA ServiceWorker registered:', reg.scope);
            })
            .catch((err) => {
                console.warn('QuickLog-Solo PWA ServiceWorker registration failed:', err);
            });
    });
}
