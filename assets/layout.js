async function loadLayout() {

    const headerElement =
        document.getElementById('siteHeader');

    const footerElement =
        document.getElementById('siteFooter');

    if (headerElement) {

        const response =
            await fetch('includes/header.html');

        headerElement.innerHTML =
            await response.text();
    }

    if (footerElement) {

        const response =
            await fetch('includes/footer.html');

        footerElement.innerHTML =
            await response.text();
    }
}

document.addEventListener(
    'DOMContentLoaded',
    async () => {

        await loadLayout();

        const page =
            location.pathname
                .split('/')
                .pop();

        document
            .querySelectorAll('nav a')
            .forEach(link => {

                const href =
                    link.getAttribute('href');

                if (href === page) {
                    link.classList.add('on');
                }
            });
    }
);