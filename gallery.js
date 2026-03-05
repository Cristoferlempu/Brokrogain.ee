function initGalleryModule() {
  const form = document.getElementById('galleryForm');
  const grid = document.getElementById('galleryGrid');
  const status = document.getElementById('galleryStatus');
  const authHint = document.getElementById('galleryAuthHint');

  if (!form || !grid || !status) return;

  loadGalleryImages();
  setupGalleryAuth(form, authHint);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const user = await getCurrentUser();
    if (!user) {
      setGalleryStatus('Logi sisse, et pilte lisada.', 'error');
      return;
    }

    const fileInput = document.getElementById('galleryImageFile');
    const imageFile = fileInput && fileInput.files ? fileInput.files[0] : null;

    if (!imageFile) {
      setGalleryStatus('Palun vali pildifail.', 'error');
      return;
    }

    if (!imageFile.type || !imageFile.type.startsWith('image/')) {
      setGalleryStatus('Vali sobiv pildifail (JPG, PNG, WEBP).', 'error');
      return;
    }

    if (imageFile.size > 10 * 1024 * 1024) {
      setGalleryStatus('Pildifail on liiga suur (max 10MB).', 'error');
      return;
    }

    const payload = {
      title: getGalleryValue('galleryImageTitle') || null,
      author_name: getGalleryValue('galleryAuthorName') || null
    };

    setGalleryStatus('Laen pilti üles…', 'loading');

    try {
      const uploadedUrl = await uploadImageToStorage(imageFile);

      if (!uploadedUrl) {
        setGalleryStatus('Pildi üleslaadimine ebaõnnestus.', 'error');
        return;
      }

      payload.image_url = uploadedUrl;

      setGalleryStatus('Salvestan andmeid…', 'loading');
      const { error } = await window.supabaseClient.from('gallery_images').insert([payload]);
      if (error) throw error;

      form.reset();
      setGalleryStatus('Pilt lisatud!', 'success');
      await loadGalleryImages();
    } catch (error) {
      console.error(error);
      setGalleryStatus('Midagi läks valesti, palun proovi uuesti.', 'error');
    }
  });
}

async function setupGalleryAuth(form, authHint) {
  const applyState = async () => {
    const user = await getCurrentUser();
    const isLoggedIn = Boolean(user);
    toggleFormEnabled(form, isLoggedIn);

    if (authHint) {
      authHint.textContent = isLoggedIn
        ? 'Võid pildi lisada.'
        : 'Pildi lisamiseks logi sisse.';
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

async function uploadImageToStorage(file) {
  const bucketName = 'gallery-images';
  const fileExt = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const safeExt = fileExt.replace(/[^a-z0-9]/g, '') || 'jpg';
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${safeExt}`;
  const filePath = `uploads/${fileName}`;

  const { error: uploadError } = await window.supabaseClient
    .storage
    .from(bucketName)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'image/jpeg'
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = window.supabaseClient.storage.from(bucketName).getPublicUrl(filePath);
  return data && data.publicUrl ? data.publicUrl : null;
}

async function loadGalleryImages() {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;

  setGalleryStatus('Laen andmeid…', 'loading');
  grid.innerHTML = '';

  try {
    const { data, error } = await window.supabaseClient
      .from('gallery_images')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    const canModerate = await isModeratorUser();

    if (!data || !data.length) {
      grid.innerHTML = '<p class="gallery-loading">No images yet.</p>';
      setGalleryStatus('');
      return;
    }

    data.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'gallery-item';

      const image = document.createElement('img');
      image.className = 'gallery-image';
      image.src = item.image_url;
      image.alt = item.title || 'Galerii pilt';
      image.loading = 'lazy';
      image.decoding = 'async';

      const content = document.createElement('div');
      content.className = 'gallery-caption';

      const title = document.createElement('h4');
      title.textContent = item.title || 'Pealkirjata pilt';

      const author = document.createElement('p');
      author.textContent = item.author_name ? `Lisas: ${item.author_name}` : 'Lisas: anonüümne';

      content.appendChild(title);
      content.appendChild(author);

      if (canModerate) {
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'btn btn-danger';
        deleteButton.textContent = 'Kustuta';
        deleteButton.addEventListener('click', async () => {
          await deleteGalleryItem(item);
        });
        content.appendChild(deleteButton);
      }

      card.appendChild(image);
      card.appendChild(content);
      grid.appendChild(card);

      if (window.observeRevealTarget) window.observeRevealTarget(card);
    });

    setGalleryStatus('');
  } catch (error) {
    console.error(error);
    setGalleryStatus('Midagi läks valesti, palun proovi uuesti.', 'error');
  }
}

function getStoragePathFromPublicUrl(url) {
  if (!url) return null;
  const marker = '/storage/v1/object/public/gallery-images/';
  const index = url.indexOf(marker);
  if (index === -1) return null;
  return decodeURIComponent(url.slice(index + marker.length));
}

async function deleteGalleryItem(item) {
  if (!item || !item.id) return;
  const confirmed = window.confirm('Kas kustutan selle pildi?');
  if (!confirmed) return;

  setGalleryStatus('Kustutan pilti…', 'loading');

  try {
    const { error, count } = await window.supabaseClient
      .from('gallery_images')
      .delete({ count: 'exact' })
      .eq('id', item.id);

    if (error) throw error;
    if (typeof count === 'number' && count === 0) {
      throw new Error('Pildi kustutamine ebaõnnestus (õigused puuduvad või rida ei leitud).');
    }

    const storagePath = getStoragePathFromPublicUrl(item.image_url);
    if (storagePath) {
      const { error: storageError } = await window.supabaseClient.storage.from('gallery-images').remove([storagePath]);
      if (storageError) {
        console.warn('Galerii fail jäi storage bucketisse alles:', storageError.message || storageError);
      }
    }

    setGalleryStatus('Pilt kustutatud.', 'success');
    await loadGalleryImages();
  } catch (error) {
    console.error(error);
    setGalleryStatus('Kustutamine ebaõnnestus. Kontrolli moderaatori õiguseid.', 'error');
  }
}

function setGalleryStatus(message, type = '') {
  const status = document.getElementById('galleryStatus');
  if (!status) return;
  status.textContent = message;
  status.className = `status-message ${type}`.trim();
}

function getGalleryValue(id) {
  const input = document.getElementById(id);
  return input ? input.value.trim() : '';
}

document.addEventListener('DOMContentLoaded', () => {
  if (!window.supabaseClient) return;
  initGalleryModule();
});
