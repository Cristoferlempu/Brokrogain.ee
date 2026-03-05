function initGalleryModule() {
  const form = document.getElementById('galleryForm');
  const grid = document.getElementById('galleryGrid');
  const status = document.getElementById('galleryStatus');

  if (!form || !grid || !status) return;

  loadGalleryImages();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = {
      image_url: getGalleryValue('galleryImageUrl'),
      title: getGalleryValue('galleryImageTitle') || null,
      author_name: getGalleryValue('galleryAuthorName') || null
    };

    if (!payload.image_url) {
      setGalleryStatus('Image URL is required.', 'error');
      return;
    }

    setGalleryStatus('Saving…', 'loading');

    try {
      const { error } = await window.supabaseClient.from('gallery_images').insert([payload]);
      if (error) throw error;

      form.reset();
      setGalleryStatus('Saved!', 'success');
      await loadGalleryImages();
    } catch (error) {
      console.error(error);
      setGalleryStatus('Something went wrong, please try again.', 'error');
    }
  });
}

async function loadGalleryImages() {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;

  setGalleryStatus('Loading data…', 'loading');
  grid.innerHTML = '';

  try {
    const { data, error } = await window.supabaseClient
      .from('gallery_images')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

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
      card.appendChild(image);
      card.appendChild(content);
      grid.appendChild(card);

      if (window.observeRevealTarget) window.observeRevealTarget(card);
    });

    setGalleryStatus('');
  } catch (error) {
    console.error(error);
    setGalleryStatus('Something went wrong, please try again.', 'error');
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
