(function () {
    const urlParams = new URLSearchParams(window.location.search);
    let theme = urlParams.get('theme');
    if (!theme) {
        theme = localStorage.getItem('maker-theme') || localStorage.getItem('studio-theme');
    }
    if (theme === 'light') {
        document.body.classList.replace('theme-dark', 'theme-light');
    } else if (!theme && window.matchMedia && !window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.body.classList.replace('theme-dark', 'theme-light');
    }
})();
