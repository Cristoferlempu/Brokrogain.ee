function initTripsModule() {
  const form = document.getElementById('tripForm');
  const list = document.getElementById('tripsList');
  const status = document.getElementById('tripsStatus');

  if (!form || !list || !status) return;

  loadTrips();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const payload = {
      title: getValue('tripTitle'),
      date: getValue('tripDate') || null,
      location: getValue('tripLocation') || null,
      description: getValue('tripDescription') || null
    };

    if (!payload.title || !payload.description) {
      setTripsStatus('Please fill in title and description.', 'error');
      return;
    }

    setTripsStatus('Saving…', 'loading');

    try {
      const { error } = await window.supabaseClient.from('trips').insert([payload]);
      if (error) throw error;

      form.reset();
      setTripsStatus('Saved!', 'success');
      await loadTrips();
    } catch (error) {
      console.error(error);
      setTripsStatus('Something went wrong, please try again.', 'error');
    }
  });
}

async function loadTrips() {
  const list = document.getElementById('tripsList');
  if (!list) return;

  setTripsStatus('Loading trips…', 'loading');
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
      card.appendChild(content);
      list.appendChild(card);

      if (window.observeRevealTarget) window.observeRevealTarget(card);
    });

    setTripsStatus('');
  } catch (error) {
    console.error(error);
    setTripsStatus('Something went wrong, please try again.', 'error');
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
