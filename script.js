let revealObserver;

document.addEventListener('DOMContentLoaded', () => {
	initThemeToggle();
	initScrollReveal();
	initAuthUserBadge();
	initTopLeaderboard();
});

async function initTopLeaderboard() {
	const kmList = document.getElementById('leaderboardListKm') || document.getElementById('leaderboardList');
	const tripsList = document.getElementById('leaderboardListTrips');
	if (!kmList && !tripsList) return;

	const client = await waitForSupabaseClient();
	if (!client) {
		if (kmList) kmList.innerHTML = '<li class="leaderboard-item">Edetabel pole hetkel saadaval.</li>';
		if (tripsList) tripsList.innerHTML = '<li class="leaderboard-item">Edetabel pole hetkel saadaval.</li>';
		return;
	}

	const { data: trips, error: tripsError } = await client
		.from('trips')
		.select('user_id, participant_user_ids, trip_length');

	if (tripsError) {
		if (kmList) kmList.innerHTML = '<li class="leaderboard-item">Edetabeli laadimine ebaõnnestus.</li>';
		if (tripsList) tripsList.innerHTML = '<li class="leaderboard-item">Edetabeli laadimine ebaõnnestus.</li>';
		return;
	}

	const rows = Array.isArray(trips) ? trips : [];
	const kmByUser = new Map();
	const tripsByUser = new Map();

	rows.forEach((trip) => {
		const participantIds = new Set();
		if (trip?.user_id) participantIds.add(trip.user_id);
		if (Array.isArray(trip?.participant_user_ids)) {
			trip.participant_user_ids.filter(Boolean).forEach((id) => participantIds.add(id));
		}
		if (!participantIds.size) return;

		participantIds.forEach((participantId) => {
			const currentTrips = tripsByUser.get(participantId) || 0;
			tripsByUser.set(participantId, currentTrips + 1);
		});

		const rawValue = String(trip.trip_length || '').trim().replace(',', '.');
		const parsedKm = Number.parseFloat(rawValue.replace(/[^\d.]/g, ''));
		if (!Number.isFinite(parsedKm)) return;

		participantIds.forEach((participantId) => {
			const current = kmByUser.get(participantId) || 0;
			kmByUser.set(participantId, current + parsedKm);
		});
	});

	if (!tripsByUser.size) {
		if (kmList) kmList.innerHTML = '<li class="leaderboard-item">Edetabelis pole veel andmeid.</li>';
		if (tripsList) tripsList.innerHTML = '<li class="leaderboard-item">Edetabelis pole veel andmeid.</li>';
		return;
	}

	const userIds = Array.from(tripsByUser.keys());
	const { data: profiles } = await client
		.from('user_profiles')
		.select('user_id, username')
		.in('user_id', userIds);

	const usernameByUserId = new Map((profiles || []).map((profile) => [profile.user_id, profile.username]));
	const leaderboardUsers = userIds
		.map((userId) => ({
			userId,
			username: usernameByUserId.get(userId) || 'Kasutaja',
			totalKm: kmByUser.get(userId) || 0,
			tripCount: tripsByUser.get(userId) || 0
		}));

	if (kmList) {
		const topByKm = [...leaderboardUsers]
			.sort((a, b) => b.totalKm - a.totalKm)
			.slice(0, 5);
		renderLeaderboard(kmList, topByKm, (entry) => `${entry.totalKm.toLocaleString('et-EE', { maximumFractionDigits: 1 })} km`);
	}

	if (tripsList) {
		const topByTrips = [...leaderboardUsers]
			.sort((a, b) => b.tripCount - a.tripCount)
			.slice(0, 5);
		renderLeaderboard(tripsList, topByTrips, (entry) => `${entry.tripCount} retke`);
	}
}

function renderLeaderboard(listElement, entries, valueFormatter) {
	if (!entries.length) {
		listElement.innerHTML = '<li class="leaderboard-item">Edetabelis pole veel andmeid.</li>';
		return;
	}

	listElement.innerHTML = '';
	entries.forEach((entry, index) => {
		const item = document.createElement('li');
		item.className = 'leaderboard-item';
		item.innerHTML = `<span class="leaderboard-rank">#${index + 1}</span><span class="leaderboard-name">${escapeHtml(entry.username)}</span><strong class="leaderboard-km">${valueFormatter(entry)}</strong>`;
		listElement.appendChild(item);
	});
}

async function waitForSupabaseClient(attempts = 20, delayMs = 120) {
	for (let index = 0; index < attempts; index += 1) {
		if (window.supabaseClient) return window.supabaseClient;
		await new Promise((resolve) => setTimeout(resolve, delayMs));
	}
	return null;
}

function escapeHtml(text) {
	return String(text)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#039;');
}

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
