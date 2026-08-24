(function () {
    const urlParams = new URLSearchParams(window.location.search);
    const themeParam = urlParams.get('theme');
    const savedTheme = localStorage.getItem('studio-theme');

    let resolvedTheme = 'dark';
    if (themeParam === 'light' || themeParam === 'dark') {
        resolvedTheme = themeParam;
    } else if (savedTheme) {
        resolvedTheme = savedTheme;
    } else if (window.matchMedia && !window.matchMedia('(prefers-color-scheme: dark)').matches) {
        resolvedTheme = 'light';
    }

    if (resolvedTheme === 'light') {
        document.body.classList.replace('theme-dark', 'theme-light');
    } else {
        document.body.classList.replace('theme-light', 'theme-dark');
    }
})();
