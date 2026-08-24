(function () {
    const urlParams = new URLSearchParams(window.location.search);
    const themeParam = urlParams.get('theme');
    const savedTheme = localStorage.getItem('quicklog-theme');
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    let resolvedTheme = 'light'; // body default is theme-light
    if (themeParam === 'light' || themeParam === 'dark') {
        resolvedTheme = themeParam;
    } else if (savedTheme) {
        resolvedTheme = savedTheme;
    } else if (prefersDark) {
        resolvedTheme = 'dark';
    }

    if (resolvedTheme === 'dark') {
        document.body.classList.replace('theme-light', 'theme-dark');
    } else {
        document.body.classList.replace('theme-dark', 'theme-light');
    }
})();
