(function () {
    const urlParams = new URLSearchParams(window.location.search);
    const themeParam = urlParams.get('theme');
    const savedTheme = localStorage.getItem('category-editor-theme');
    const prefersLight = window.matchMedia && !window.matchMedia('(prefers-color-scheme: dark)').matches;

    let resolvedTheme = 'dark'; // body default is theme-dark
    if (themeParam === 'light' || themeParam === 'dark') {
        resolvedTheme = themeParam;
    } else if (savedTheme) {
        resolvedTheme = savedTheme;
    } else if (prefersLight) {
        resolvedTheme = 'light';
    }

    if (resolvedTheme === 'light') {
        document.body.classList.replace('theme-dark', 'theme-light');
    } else {
        document.body.classList.replace('theme-light', 'theme-dark');
    }
})();
