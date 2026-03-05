let revealObserver;

document.addEventListener('DOMContentLoaded', () => {
	initThemeToggle();
	initScrollReveal();
});

function initThemeToggle() {
	const toggleButton = document.getElementById('themeToggle');
	if (!toggleButton) return;

	const savedTheme = localStorage.getItem('site-theme');
	const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
	const useDark = savedTheme ? savedTheme === 'dark' : prefersDark;
	setTheme(useDark);

	toggleButton.addEventListener('click', () => {
		setTheme(!document.body.classList.contains('dark-mode'));
	});
}

function setTheme(isDarkMode) {
	const toggleButton = document.getElementById('themeToggle');
	document.body.classList.toggle('dark-mode', isDarkMode);
	localStorage.setItem('site-theme', isDarkMode ? 'dark' : 'light');

	if (!toggleButton) return;
	toggleButton.setAttribute('aria-pressed', String(isDarkMode));
	toggleButton.textContent = isDarkMode ? '☀️ Hele režiim' : '🌙 Tume režiim';
}

function initScrollReveal() {
	const targets = document.querySelectorAll('.welcome, .content-section, .card, .gallery-item, .trip-info, .map-section, .blog-post');
	if (!targets.length) return;

	if (!('IntersectionObserver' in window)) {
		targets.forEach((target) => target.classList.add('is-visible'));
		return;
	}

	revealObserver = new IntersectionObserver((entries, observer) => {
		entries.forEach((entry) => {
			if (!entry.isIntersecting) return;
			entry.target.classList.add('is-visible');
			observer.unobserve(entry.target);
		});
	}, {
		threshold: 0.14,
		rootMargin: '0px 0px -8% 0px'
	});

	targets.forEach(observeRevealTarget);
}

function observeRevealTarget(element) {
	if (!element) return;
	if (!revealObserver) {
		element.classList.add('is-visible');
		return;
	}
	revealObserver.observe(element);
}

window.observeRevealTarget = observeRevealTarget;
