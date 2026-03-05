let revealObserver;

document.addEventListener('DOMContentLoaded', () => {
	initThemeToggle();
	initScrollReveal();
	initAuthUserBadge();
});

function initAuthUserBadge() {
	if (!window.supabaseClient || !window.supabaseClient.auth) return;

	let badge = document.getElementById('authUserBadge');
	if (!badge) {
		badge = document.createElement('div');
		badge.id = 'authUserBadge';
		badge.className = 'auth-user-badge';
		document.body.appendChild(badge);
	}

	const render = async () => {
		const { data, error } = await window.supabaseClient.auth.getUser();
		if (error || !data?.user) {
			badge.hidden = true;
			return;
		}

		const username = await getUsernameForBadge(data.user.id);
		badge.textContent = `Logitud sisse kasutajaga: ${username || data.user.email}`;
		badge.hidden = false;
	};

	render();
	window.supabaseClient.auth.onAuthStateChange(() => {
		render();
	});
}

async function getUsernameForBadge(userId) {
	if (!userId || !window.supabaseClient) return null;

	const { data, error } = await window.supabaseClient
		.from('user_profiles')
		.select('username')
		.eq('user_id', userId)
		.maybeSingle();

	if (error) return null;
	return data?.username || null;
}

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
