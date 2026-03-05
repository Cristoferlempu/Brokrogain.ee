let supabaseClient;
const GALLERY_SCRIPT_VERSION = '2026-03-04-v1';

const SUPABASE_URL_DIRECT = 'https://nopbjnlekekvkaewljos.supabase.co';
const SUPABASE_ANON_KEY_DIRECT = 'sb_publishable_gjkC98hxVVQNA5fzeXEOVQ_g5Kcrg7o';
let supabaseConfig = { url: '', key: '' };

document.addEventListener('DOMContentLoaded', function() {
	initSupabase();
	bindGalleryEvents();
	loadGallery();
	initThemeToggle();
	initHikeForm();
	initFeedback();
	console.log(`🧩 Gallery script version: ${GALLERY_SCRIPT_VERSION}`);
});

function bindGalleryEvents() {
	const uploadButton = document.getElementById('uploadButton');
	if (!uploadButton) return;
	uploadButton.addEventListener('click', uploadImage);
}

function setUploadButtonLoading(isLoading) {
	const uploadButton = document.getElementById('uploadButton');
	if (!uploadButton) return;
	uploadButton.disabled = isLoading;
	uploadButton.classList.toggle('is-loading', isLoading);
	uploadButton.textContent = isLoading ? '⏳ Laen üles...' : '📤 Laadi üles';
}

function renderGalleryLoading() {
	const container = document.getElementById('galleryContainer');
	if (!container) return;
	container.innerHTML = '<p class="gallery-loading">⏳ Galerii laadib...</p>';
}

function renderGalleryError(message) {
	const container = document.getElementById('galleryContainer');
	if (!container) return;
	container.innerHTML = `<p class="gallery-loading">${message}</p>`;
}

function formatFileSize(bytes) {
	if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
	if (bytes < 1024) return `${bytes} B`;
	const kilobytes = bytes / 1024;
	if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;
	return `${(kilobytes / 1024).toFixed(1)} MB`;
}

function initSupabase() {
	if (!window.supabase) return;
	const SUPABASE_URL = SUPABASE_URL_DIRECT.trim();
	const SUPABASE_ANON_KEY = SUPABASE_ANON_KEY_DIRECT.trim();
	supabaseConfig.url = SUPABASE_URL;
	supabaseConfig.key = SUPABASE_ANON_KEY;
	if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return;

	supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
		auth: {
			persistSession: false,
			autoRefreshToken: false,
			detectSessionInUrl: false
		}
	});
}

function setUploadStatus(message, type = '') {
	const statusEl = document.getElementById('uploadStatus');
	if (!statusEl) return;
	statusEl.textContent = message;
	statusEl.classList.remove('success', 'error', 'loading', 'info');
	if (!message) return;
	statusEl.classList.add(type || 'info');
}

async function loadGallery() {
	if (!supabaseClient) return;

	renderGalleryLoading();
	setUploadStatus('⏳ Laen galeriid...', 'loading');

	try {
		const { data, error } = await supabaseClient
			.from('gallery_posts')
			.select('*')
			.order('created_at', { ascending: false });

		if (error) {
			setUploadStatus(`❌ ${error.message}`, 'error');
			renderGalleryError('❌ Galerii laadimine ebaõnnestus.');
			return;
		}

		setUploadStatus('');
		displayGallery(data || []);
	} catch {
		setUploadStatus('❌ Galerii laadimine ebaõnnestus.', 'error');
		renderGalleryError('❌ Galerii laadimine ebaõnnestus.');
	}
}

function displayGallery(posts) {
	const container = document.getElementById('galleryContainer');
	if (!container) return;
	container.innerHTML = '';

	if (!posts.length) {
		container.innerHTML = '<p class="gallery-loading">Galerii on tühi. Ole esimene, kes pildi üles laadib!</p>';
		return;
	}

	posts.forEach(post => {
		const item = document.createElement('div');
		item.className = 'gallery-item';

		const imageWrapper = document.createElement('div');
		imageWrapper.className = 'gallery-item-image-wrapper is-loading';

		const imageLoading = document.createElement('div');
		imageLoading.className = 'gallery-image-loading';
		imageLoading.textContent = 'Laen pilti...';

		const image = document.createElement('img');
		image.src = post.image_data;
		image.alt = post.title || 'Galerii pilt';
		image.loading = 'lazy';
		image.decoding = 'async';
		image.className = 'gallery-image';
		image.addEventListener('load', () => imageWrapper.classList.remove('is-loading'));
		image.addEventListener('error', () => {
			imageWrapper.classList.remove('is-loading');
			imageLoading.textContent = 'Pildi laadimine ebaõnnestus';
		});

		const content = document.createElement('div');
		content.style.padding = '10px';
		const title = document.createElement('h4');
		title.textContent = post.title || 'Asukoht puudub';
		const date = document.createElement('p');
		date.style.color = '#666';
		date.style.fontSize = '14px';
		date.textContent = post.collection_name || 'Kuupäev puudub';

		imageWrapper.appendChild(imageLoading);
		imageWrapper.appendChild(image);
		content.appendChild(title);
		content.appendChild(date);
		item.appendChild(imageWrapper);
		item.appendChild(content);
		container.appendChild(item);
	});
}

async function uploadImage() {
	const collectionInput = document.getElementById('collectionName');
	const fileInput = document.getElementById('imageInput');
	const titleInput = document.getElementById('imageTitle');

	if (!supabaseClient) {
		setUploadStatus('❌ Andmebaasi ühendus puudub', 'error');
		return;
	}
	if (!collectionInput.value.trim() || !fileInput.files[0] || !titleInput.value.trim()) {
		setUploadStatus('❌ Täida kõik väljad', 'error');
		return;
	}

	const file = fileInput.files[0];
	if (!file.type || !file.type.startsWith('image/')) {
		setUploadStatus('❌ Vali pildifail (JPG, PNG, WEBP).', 'error');
		return;
	}
	if (file.size > 5 * 1024 * 1024) {
		setUploadStatus('❌ Pilt on liiga suur (max 5MB)', 'error');
		return;
	}

	setUploadStatus(`⏳ Valmis üleslaadimiseks (${formatFileSize(file.size)})...`, 'loading');
	setUploadButtonLoading(true);

	const reader = new FileReader();
	reader.onload = async function(e) {
		try {
			const { error } = await supabaseClient
				.from('gallery_posts')
				.insert({
					collection_name: collectionInput.value.trim(),
					title: titleInput.value.trim(),
					image_data: e.target.result,
					created_at: new Date().toISOString()
				});

			if (error) {
				setUploadStatus(`❌ ${error.message}`, 'error');
				return;
			}

			setUploadStatus('✅ Pilt üles laaditud!', 'success');
			collectionInput.value = '';
			fileInput.value = '';
			titleInput.value = '';
			setTimeout(() => {
				setUploadStatus('');
				loadGallery();
			}, 600);
		} catch (err) {
			setUploadStatus('❌ Viga: ' + err.message, 'error');
		} finally {
			setUploadButtonLoading(false);
		}
	};

	reader.onerror = function() {
		setUploadStatus('❌ Pildi lugemine ebaõnnestus.', 'error');
		setUploadButtonLoading(false);
	};

	reader.readAsDataURL(file);
}

function initThemeToggle() {
	const toggleButton = document.getElementById('themeToggle');
	if (!toggleButton) return;

	const savedTheme = localStorage.getItem('site-theme');
	const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
	const useDark = savedTheme ? savedTheme === 'dark' : prefersDark;
	setTheme(useDark);

	toggleButton.addEventListener('click', () => {
		const isDarkMode = !document.body.classList.contains('dark-mode');
		setTheme(isDarkMode);
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

function initHikeForm() {
	const addHikeButton = document.getElementById('addHikeButton');
	if (!addHikeButton) return;
	addHikeButton.addEventListener('click', addHike);
}

function addHike() {
	const dateInput = document.getElementById('hikeDate');
	const distanceInput = document.getElementById('hikeDistance');
	const durationInput = document.getElementById('hikeDuration');
	const difficultyInput = document.getElementById('hikeDifficulty');
	const routeInput = document.getElementById('hikeRoute');
	const summaryInput = document.getElementById('hikeSummary');
	const locationInput = document.getElementById('hikeLocation');
	const linkInput = document.getElementById('hikeLink');
	const status = document.getElementById('hikeStatus');
	const container = document.getElementById('hikesContainer');

	if (!dateInput || !distanceInput || !durationInput || !difficultyInput || !routeInput || !summaryInput || !locationInput || !linkInput || !status || !container) return;

	const values = {
		date: dateInput.value.trim(),
		distance: distanceInput.value.trim(),
		duration: durationInput.value.trim(),
		difficulty: difficultyInput.value.trim(),
		route: routeInput.value.trim(),
		summary: summaryInput.value.trim(),
		location: locationInput.value.trim(),
		link: linkInput.value.trim()
	};

	const required = ['date', 'distance', 'duration', 'difficulty', 'route', 'summary', 'location'];
	const hasMissing = required.some(key => !values[key]);
	if (hasMissing) {
		status.className = 'error';
		status.textContent = 'Palun täida kõik kohustuslikud väljad.';
		status.style.display = 'block';
		return;
	}

	const card = document.createElement('article');
	card.className = 'card';

	const image = document.createElement('img');
	image.className = 'card-image';
	image.loading = 'lazy';
	image.decoding = 'async';
	image.src = 'img/taustapilt.jpg';
	image.alt = `${values.location} retke illustratsioon`;

	const content = document.createElement('div');
	content.className = 'card-content';

	const title = document.createElement('h3');
	title.textContent = values.location;

	const meta = document.createElement('div');
	meta.className = 'card-meta';
	[
		`🧭 Marsruut: ${values.route}`,
		`📍 ${values.distance}`,
		`📅 ${formatHikeDate(values.date)}`,
		`⏱️ ${values.duration}`,
		`⭐ ${values.difficulty}`
	].forEach((textValue) => {
		const span = document.createElement('span');
		span.textContent = textValue;
		meta.appendChild(span);
	});

	const summary = document.createElement('p');
	summary.textContent = values.summary;

	const link = document.createElement('a');
	link.href = values.link || '#';
	link.textContent = values.link ? 'Ava retkepäevik →' : 'Päeviku link lisamata';
	if (!values.link) link.addEventListener('click', (event) => event.preventDefault());

	content.appendChild(title);
	content.appendChild(meta);
	content.appendChild(summary);
	content.appendChild(link);
	card.appendChild(image);
	card.appendChild(content);
	container.prepend(card);

	status.className = 'success';
	status.textContent = 'Retk lisatud!';
	status.style.display = 'block';

	dateInput.value = '';
	distanceInput.value = '';
	durationInput.value = '';
	difficultyInput.value = '';
	routeInput.value = '';
	summaryInput.value = '';
	locationInput.value = '';
	linkInput.value = '';
}

function formatHikeDate(dateValue) {
	const date = new Date(dateValue);
	if (Number.isNaN(date.getTime())) return dateValue;
	return new Intl.DateTimeFormat('et-EE', { day: '2-digit', month: 'long', year: 'numeric' }).format(date);
}

function initFeedback() {
	const form = document.getElementById('feedbackForm');
	const list = document.getElementById('feedbackList');
	if (!form || !list) return;

	const storageKey = form.dataset.feedbackKey || `comments-${window.location.pathname}`;
	renderFeedback(storageKey, list);

	form.addEventListener('submit', (event) => {
		event.preventDefault();
		const nameInput = document.getElementById('feedbackName');
		const messageInput = document.getElementById('feedbackMessage');
		if (!nameInput || !messageInput) return;

		const name = nameInput.value.trim();
		const message = messageInput.value.trim();
		if (!name || !message) return;

		const comments = readFeedback(storageKey);
		comments.unshift({ name, message, createdAt: new Date().toISOString() });
		localStorage.setItem(storageKey, JSON.stringify(comments.slice(0, 20)));
		nameInput.value = '';
		messageInput.value = '';
		renderFeedback(storageKey, list);
	});
}

function readFeedback(storageKey) {
	try {
		return JSON.parse(localStorage.getItem(storageKey) || '[]');
	} catch {
		return [];
	}
}

function renderFeedback(storageKey, listElement) {
	const comments = readFeedback(storageKey);
	listElement.innerHTML = '';

	if (!comments.length) {
		const emptyItem = document.createElement('li');
		emptyItem.textContent = 'Kommentaare veel ei ole. Ole esimene!';
		listElement.appendChild(emptyItem);
		return;
	}

	comments.forEach((comment) => {
		const item = document.createElement('li');
		const author = document.createElement('strong');
		author.textContent = comment.name;
		const text = document.createElement('p');
		text.textContent = comment.message;
		const time = document.createElement('small');
		time.textContent = new Intl.DateTimeFormat('et-EE', {
			day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
		}).format(new Date(comment.createdAt));
		item.appendChild(author);
		item.appendChild(text);
		item.appendChild(time);
		listElement.appendChild(item);
	});
}
