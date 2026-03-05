function initTripsModule() {
  const form = document.getElementById('tripForm');
  const list = document.getElementById('tripsList');
  const status = document.getElementById('tripsStatus');
  const authHint = document.getElementById('tripsAuthHint');

  if (!form || !list || !status) return;

  loadTrips();
  setupTripsAuth(form, authHint);
  initTaggedUsersAutocomplete();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const user = await getCurrentUser();
    if (!user) {
      setTripsStatus('Logi sisse, et retki lisada.', 'error');
      return;
    }

    const taggedUsernames = parseTaggedUsernames(getValue('tripTaggedUsers'));
    const participantUserIds = await resolveParticipantUserIds(taggedUsernames);

    if (participantUserIds.missingUsernames.length) {
      setTripsStatus(`Neid kasutajaid ei leitud: ${participantUserIds.missingUsernames.join(', ')}`, 'error');
      return;
    }

    const payload = {
      title: getValue('tripTitle'),
      user_id: user.id,
      participant_user_ids: Array.from(new Set([user.id, ...participantUserIds.userIds])),
      date: getValue('tripDate') || null,
      location: getValue('tripLocation') || null,
      trip_length: getValue('tripLength') || null,
      description: getValue('tripDescription') || null
    };

    if (payload.trip_length) {
      const parsedLength = Number.parseFloat(String(payload.trip_length).replace(',', '.'));
      if (!Number.isFinite(parsedLength)) {
        setTripsStatus('Retke pikkus peab olema number.', 'error');
        return;
      }
      payload.trip_length = String(parsedLength);
    }
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
      if (String(error.message || '').includes('trip_length')) {
        setTripsStatus('Lisa Supabase SQL Editoris: alter table public.trips add column if not exists trip_length text;', 'error');
        return;
      }
      if (String(error.message || '').includes('user_id')) {
        setTripsStatus('Lisa Supabase SQL Editoris: alter table public.trips add column if not exists user_id uuid references auth.users(id) on delete set null;', 'error');
        return;
      }
      if (String(error.message || '').includes('participant_user_ids')) {
        setTripsStatus('Lisa Supabase SQL Editoris: alter table public.trips add column if not exists participant_user_ids uuid[];', 'error');
        return;
      }
      setTripsStatus('Midagi läks valesti, palun proovi uuesti.', 'error');
    }
  });
}

function initTaggedUsersAutocomplete() {
  const input = document.getElementById('tripTaggedUsers');
  const suggestions = document.getElementById('tripTaggedUsersSuggestions');
  if (!input || !suggestions) return;

  let debounceTimer = null;
  let lastQueryId = 0;

  const hideSuggestions = () => {
    suggestions.hidden = true;
    suggestions.innerHTML = '';
  };

  input.addEventListener('input', () => {
    if (debounceTimer) window.clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(async () => {
      const activeQuery = getActiveTaggedUserQuery(input.value);
      if (!activeQuery || activeQuery.length < 1) {
        hideSuggestions();
        return;
      }

      const currentQueryId = ++lastQueryId;
      const usernames = await fetchUserSuggestions(activeQuery);
      if (currentQueryId !== lastQueryId) return;

      const alreadyTagged = new Set(parseTaggedUsernames(input.value));
      const filtered = usernames.filter((username) => !alreadyTagged.has(username));

      if (!filtered.length) {
        hideSuggestions();
        return;
      }

      suggestions.innerHTML = '';
      filtered.forEach((username) => {
        const item = document.createElement('li');
        item.className = 'tag-suggestion-item';

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'tag-suggestion-btn';
        button.textContent = username;
        button.addEventListener('mousedown', (event) => {
          event.preventDefault();
        });
        button.addEventListener('click', () => {
          const tagged = parseTaggedUsernames(input.value);
          if (!tagged.includes(username)) tagged.push(username);
          input.value = tagged.length ? `${tagged.join(', ')}, ` : '';
          hideSuggestions();
          input.focus();
        });

        item.appendChild(button);
        suggestions.appendChild(item);
      });

      suggestions.hidden = false;
    }, 160);
  });

  input.addEventListener('blur', () => {
    window.setTimeout(hideSuggestions, 120);
  });

  input.addEventListener('focus', () => {
    if (suggestions.children.length) suggestions.hidden = false;
  });

  document.addEventListener('click', (event) => {
    if (event.target === input || suggestions.contains(event.target)) return;
    hideSuggestions();
  });
}

async function fetchUserSuggestions(query) {
  if (!query) return [];

  const { data, error } = await window.supabaseClient
    .from('user_profiles')
    .select('username')
    .ilike('username', `${query}%`)
    .order('username', { ascending: true })
    .limit(6);

  if (error) return [];
  return (Array.isArray(data) ? data : [])
    .map((row) => String(row.username || '').trim().toLowerCase())
    .filter(Boolean);
}

function getActiveTaggedUserQuery(rawValue) {
  const segments = String(rawValue || '').split(',');
  return String(segments[segments.length - 1] || '').trim().toLowerCase();
}

function parseTaggedUsernames(rawValue) {
  if (!rawValue) return [];
  return Array.from(new Set(
    String(rawValue)
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  ));
}

async function resolveParticipantUserIds(usernames) {
  if (!usernames.length) {
    return { userIds: [], missingUsernames: [] };
  }

  const { data, error } = await window.supabaseClient
    .from('user_profiles')
    .select('user_id, username')
    .in('username', usernames);

  if (error) {
    return { userIds: [], missingUsernames: usernames };
  }

  const rows = Array.isArray(data) ? data : [];
  const foundMap = new Map(rows.map((row) => [String(row.username || '').toLowerCase(), row.user_id]));
  const userIds = usernames.map((username) => foundMap.get(username)).filter(Boolean);
  const missingUsernames = usernames.filter((username) => !foundMap.has(username));

  return {
    userIds,
    missingUsernames
  };
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
        ? 'Võid retke lisada.'
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
  if (window.appAuth?.getCurrentUser) return window.appAuth.getCurrentUser();
  const { data, error } = await window.supabaseClient.auth.getUser();
  if (error) return null;
  return data?.user || null;
}

async function isModeratorUser() {
  if (!window.appAuth?.isModerator) return false;
  return window.appAuth.isModerator();
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
    const canModerate = await isModeratorUser();

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
      if (trip.trip_length) meta.appendChild(buildMeta(`📏 ${trip.trip_length}`));

      const desc = document.createElement('p');
      desc.textContent = trip.description || '';

      content.appendChild(h3);
      content.appendChild(meta);
      content.appendChild(desc);

      if (canModerate) {
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'btn btn-danger';
        deleteButton.textContent = 'Kustuta';
        deleteButton.addEventListener('click', async () => {
          await deleteTrip(trip);
        });
        content.appendChild(deleteButton);
      }

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

function getStoragePathFromPublicUrl(url) {
  if (!url) return null;
  const marker = '/storage/v1/object/public/gallery-images/';
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
}

async function deleteTrip(trip) {
  if (!trip || !trip.id) return;
  const confirmed = window.confirm('Kas kustutan selle retke?');
  if (!confirmed) return;

  setTripsStatus('Kustutan retke…', 'loading');

  try {
    const { data, error } = await window.supabaseClient
      .from('trips')
      .delete()
      .eq('id', trip.id)
      .select('id');

    if (error) throw error;
    if (!data || !data.length) {
      throw new Error('Retke kustutamine ebaõnnestus (õigused puuduvad või rida ei leitud).');
    }

    const storagePath = getStoragePathFromPublicUrl(trip.image_url);
    if (storagePath) {
      const { error: storageError } = await window.supabaseClient.storage.from('gallery-images').remove([storagePath]);
      if (storageError) {
        console.warn('Retke pilt jäi storage bucketisse alles:', storageError.message || storageError);
      }
    }

    setTripsStatus('Retk kustutatud.', 'success');
    await loadTrips();
  } catch (error) {
    console.error(error);
    setTripsStatus('Kustutamine ebaõnnestus. Kontrolli moderaatori õiguseid.', 'error');
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
