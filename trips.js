function initTripsModule() {
  const form = document.getElementById('tripForm');
  const list = document.getElementById('tripsList');
  const status = document.getElementById('tripsStatus');
  const authHint = document.getElementById('tripsAuthHint');

  if (!form || !list || !status) return;

  loadTrips();
  setupTripsAuth(form, authHint);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const user = await getCurrentUser();
    if (!user) {
      setTripsStatus('Logi sisse, et retki lisada.', 'error');
      return;
    }

    const payload = {
      title: getValue('tripTitle'),
      date: getValue('tripDate') || null,
      location: getValue('tripLocation') || null,
      description: getValue('tripDescription') || null
    };
    const imageFileInput = document.getElementById('tripImageFile');
    const imageFile = imageFileInput && imageFileInput.files ? imageFileInput.files[0] : null;

    if (!payload.title || !payload.description) {
      setTripsStatus('Please fill in title and description.', 'error');
      return;
    }

    if (imageFile) {
      if (!imageFile.type || !imageFile.type.startsWith('image/')) {
        setTripsStatus('Vali sobiv pildifail (JPG, PNG, WEBP).', 'error');
        return;
      }
      if (imageFile.size > 10 * 1024 * 1024) {
        setTripsStatus('Pildifail on liiga suur (max 10MB).', 'error');
        return;
      }
    }

    setTripsStatus('Salvestan…', 'loading');

    try {
      if (imageFile) {
        const uploadedUrl = await uploadTripImageToStorage(imageFile);
        if (!uploadedUrl) {
          setTripsStatus('Pildi üleslaadimine ebaõnnestus.', 'error');
          return;
        }
        payload.image_url = uploadedUrl;
      }

      const { error } = await window.supabaseClient.from('trips').insert([payload]);
      if (error) throw error;

      form.reset();
      setTripsStatus('Retk lisatud!', 'success');
      await loadTrips();
    } catch (error) {
      console.error(error);
      if (String(error.message || '').includes('image_url')) {
        setTripsStatus('Lisa Supabase SQL Editoris: alter table public.trips add column if not exists image_url text;', 'error');
        return;
      }
      setTripsStatus('Midagi läks valesti, palun proovi uuesti.', 'error');
    }
  });
}

async function uploadTripImageToStorage(file) {
  const bucketName = 'gallery-images';
  const fileExt = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const safeExt = fileExt.replace(/[^a-z0-9]/g, '') || 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;
  const filePath = `uploads/${fileName}`;

  const { error } = await window.supabaseClient
    .storage
    .from(bucketName)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'image/jpeg'
    });

  if (error) throw error;

  const { data } = window.supabaseClient.storage.from(bucketName).getPublicUrl(filePath);
  return data?.publicUrl || null;
}

async function setupTripsAuth(form, authHint) {
  const applyState = async () => {
    const user = await getCurrentUser();
    const isLoggedIn = Boolean(user);
    toggleFormEnabled(form, isLoggedIn);

    if (authHint) {
      authHint.textContent = isLoggedIn
        ? `Sisse logitud: ${user.email}`
        : 'Retke lisamiseks logi sisse.';
      authHint.className = `status-message ${isLoggedIn ? 'success' : 'info'}`;
    }
  };

  await applyState();
  window.supabaseClient.auth.onAuthStateChange(() => {
    applyState();
  });
}

function toggleFormEnabled(form, enabled) {
  const controls = form.querySelectorAll('input, textarea, button');
  controls.forEach((control) => {
    control.disabled = !enabled;
  });
}

async function getCurrentUser() {
  const { data, error } = await window.supabaseClient.auth.getUser();
  if (error) return null;
  return data?.user || null;
}

async function loadTrips() {
  const list = document.getElementById('tripsList');
  if (!list) return;

  setTripsStatus('Laen retki…', 'loading');
  list.innerHTML = '';

  try {
    const { data, error } = await window.supabaseClient
      .from('trips')
      .select('*')
      .order('date', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!data || !data.length) {
      list.innerHTML = '<p class="gallery-loading">No trips yet.</p>';
      setTripsStatus('');
      return;
    }

    data.forEach((trip) => {
      const card = document.createElement('article');
      card.className = 'card';

      const image = document.createElement('img');
      image.className = 'card-image';
      image.loading = 'lazy';
      image.decoding = 'async';
      image.src = trip.image_url || 'img/taustapilt.jpg';
      image.alt = trip.title || 'Retke pilt';

      const content = document.createElement('div');
      content.className = 'card-content';

      const h3 = document.createElement('h3');
      h3.textContent = trip.title;

      const meta = document.createElement('div');
      meta.className = 'card-meta';
      if (trip.date) meta.appendChild(buildMeta(`📅 ${formatDate(trip.date)}`));
      if (trip.location) meta.appendChild(buildMeta(`📍 ${trip.location}`));

      const desc = document.createElement('p');
      desc.textContent = trip.description || '';

      content.appendChild(h3);
      content.appendChild(meta);
      content.appendChild(desc);
      card.appendChild(image);
      card.appendChild(content);
      list.appendChild(card);

      if (window.observeRevealTarget) window.observeRevealTarget(card);
    });

    setTripsStatus('');
  } catch (error) {
    console.error(error);
    setTripsStatus('Midagi läks valesti, palun proovi uuesti.', 'error');
  }
}

function buildMeta(text) {
  const span = document.createElement('span');
  span.textContent = text;
  return span;
}

function setTripsStatus(message, type = '') {
  const status = document.getElementById('tripsStatus');
  if (!status) return;
  status.textContent = message;
  status.className = `status-message ${type}`.trim();
}

function getValue(id) {
  const input = document.getElementById(id);
  return input ? input.value.trim() : '';
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('et-EE', {
    day: '2-digit', month: 'long', year: 'numeric'
  }).format(date);
}

document.addEventListener('DOMContentLoaded', () => {
  if (!window.supabaseClient) return;
  initTripsModule();
});
