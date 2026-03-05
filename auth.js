function initAuthPage() {
  const registerForm = document.getElementById('registerForm');
  const loginForm = document.getElementById('loginForm');
  const logoutButton = document.getElementById('logoutButton');
  const status = document.getElementById('authStatus');
  const currentUser = document.getElementById('currentUser');
  const registerSection = document.getElementById('registerSection');
  const loginSection = document.getElementById('loginSection');
  const logoutSection = document.getElementById('logoutSection');
  const openStatsButton = document.getElementById('openStatsButton');
  const closeStatsButton = document.getElementById('closeStatsButton');
  const statsModal = document.getElementById('statsModal');
  const statsKilometers = document.getElementById('statsKilometers');
  const statsTripsCount = document.getElementById('statsTripsCount');
  const statsModalStatus = document.getElementById('statsModalStatus');

  if (!registerForm || !loginForm || !logoutButton || !status || !currentUser || !registerSection || !loginSection || !logoutSection) return;

  refreshAuthState(currentUser, status, registerSection, loginSection, logoutSection);

  window.supabaseClient.auth.onAuthStateChange(() => {
    refreshAuthState(currentUser, status, registerSection, loginSection, logoutSection);
  });

  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = normalizeUsername(readValue('registerUsername'));
    const email = readValue('registerEmail');
    const password = readValue('registerPassword');

    if (!username || !email || !password) {
      setAuthStatus('Täida username, email ja parool.', 'error');
      return;
    }

    if (username.length < 3) {
      setAuthStatus('Username peab olema vähemalt 3 märki.', 'error');
      return;
    }

    setAuthStatus('Loon kontot…', 'loading');
    const { data, error } = await window.supabaseClient.auth.signUp({
      email,
      password,
      options: {
        data: { username }
      }
    });

    if (error) {
      setAuthStatus(error.message, 'error');
      return;
    }

    const userId = data?.user?.id;
    if (userId) {
      const { error: profileError } = await window.supabaseClient
        .from('user_profiles')
        .upsert([{ user_id: userId, username, email }], { onConflict: 'user_id' });

      if (profileError) {
        setAuthStatus('Konto loodi, aga profiili salvestamine ebaõnnestus. Kontrolli user_profiles SQL seadistust.', 'error');
        return;
      }
    }

    registerForm.reset();
    setAuthStatus('Konto loodud! Kontrolli vajadusel emaili kinnitust.', 'success');
  });

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const username = normalizeUsername(readValue('loginUsername'));
    const password = readValue('loginPassword');

    if (!username || !password) {
      setAuthStatus('Täida username ja parool.', 'error');
      return;
    }

    setAuthStatus('Login…', 'loading');
    const email = await getEmailByUsername(username);
    if (!email) {
      setAuthStatus('Selle username-ga kontot ei leitud.', 'error');
      return;
    }

    const { error } = await window.supabaseClient.auth.signInWithPassword({ email, password });

    if (error) {
      setAuthStatus(error.message, 'error');
      return;
    }

    loginForm.reset();
    setAuthStatus('Sisselogimine õnnestus.', 'success');

    const next = new URLSearchParams(window.location.search).get('next');
    if (next) {
      window.location.href = next;
    }
  });

  logoutButton.addEventListener('click', async () => {
    setAuthStatus('Log out…', 'loading');
    const { error } = await window.supabaseClient.auth.signOut();

    if (error) {
      setAuthStatus(error.message, 'error');
      return;
    }

    setAuthStatus('Väljalogitud.', 'success');
  });

  if (openStatsButton && closeStatsButton && statsModal && statsKilometers && statsTripsCount && statsModalStatus) {
    const openStatsModal = async () => {
      statsModal.hidden = false;
      statsModal.style.display = 'grid';
      await loadMyStats(statsKilometers, statsTripsCount, statsModalStatus);
    };

    const closeStatsModal = () => {
      statsModal.hidden = true;
      statsModal.style.display = 'none';
    };

    closeStatsModal();

    openStatsButton.addEventListener('click', async () => {
      await openStatsModal();
    });

    closeStatsButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeStatsModal();
    });

    statsModal.addEventListener('click', (event) => {
      if (event.target === statsModal) {
        closeStatsModal();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !statsModal.hidden) {
        closeStatsModal();
      }
    });
  }
}

async function loadMyStats(kmElement, countElement, statusElement) {
  kmElement.textContent = '—';
  countElement.textContent = '—';
  statusElement.textContent = 'Laen statistikat…';
  statusElement.className = 'status-message loading';

  const { data: authData, error: authError } = await window.supabaseClient.auth.getUser();
  const user = authData?.user || null;

  if (authError || !user) {
    statusElement.textContent = 'Logi sisse, et näha oma statistikat.';
    statusElement.className = 'status-message error';
    return;
  }

  const { data, error } = await window.supabaseClient
    .from('trips')
    .select('user_id, participant_user_ids, trip_length');

  if (error) {
    statusElement.textContent = 'Statistika laadimine ebaõnnestus.';
    statusElement.className = 'status-message error';
    return;
  }

  const rows = Array.isArray(data) ? data : [];
  const userRows = rows.filter((row) => {
    const participants = new Set();
    if (row?.user_id) participants.add(row.user_id);
    if (Array.isArray(row?.participant_user_ids)) {
      row.participant_user_ids.filter(Boolean).forEach((id) => participants.add(id));
    }
    return participants.has(user.id);
  });

  const totalTrips = userRows.length;
  const totalKm = userRows.reduce((sum, row) => {
    const rawValue = String(row?.trip_length || '').trim().replace(',', '.');
    const parsed = Number.parseFloat(rawValue.replace(/[^\d.]/g, ''));
    return Number.isFinite(parsed) ? sum + parsed : sum;
  }, 0);

  kmElement.textContent = `${totalKm.toLocaleString('et-EE', { maximumFractionDigits: 1 })} km`;
  countElement.textContent = String(totalTrips);
  statusElement.textContent = 'Statistika uuendatud.';
  statusElement.className = 'status-message success';
}

async function refreshAuthState(currentUser, statusElement, registerSection, loginSection, logoutSection) {
  const { data, error } = await window.supabaseClient.auth.getUser();

  if (error) {
    setAuthStatus(error.message, 'error');
    currentUser.textContent = 'Pole sisse logitud';
    setAuthSections(false, registerSection, loginSection, logoutSection);
    return;
  }

  if (!data.user) {
    currentUser.textContent = 'Pole sisse logitud';
    setAuthSections(false, registerSection, loginSection, logoutSection);
    if (!statusElement.textContent) setAuthStatus('Logi sisse või loo konto.', 'info');
    return;
  }

  const username = await getUsernameByUserId(data.user.id);
  currentUser.textContent = `Sisse logitud: ${username || data.user.email}`;
  setAuthSections(true, registerSection, loginSection, logoutSection);
  if (!statusElement.textContent || statusElement.className.includes('info')) {
    setAuthStatus('Autentimine aktiivne.', 'success');
  }
}

async function getEmailByUsername(username) {
  const { data, error } = await window.supabaseClient
    .from('user_profiles')
    .select('email')
    .eq('username', username)
    .maybeSingle();

  if (error) {
    console.error(error);
    return null;
  }

  return data?.email || null;
}

async function getUsernameByUserId(userId) {
  if (!userId) return null;

  const { data, error } = await window.supabaseClient
    .from('user_profiles')
    .select('username')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return null;
  return data?.username || null;
}

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function setAuthSections(isLoggedIn, registerSection, loginSection, logoutSection) {
  registerSection.hidden = isLoggedIn;
  loginSection.hidden = isLoggedIn;
  logoutSection.hidden = !isLoggedIn;
}

function readValue(id) {
  const input = document.getElementById(id);
  return input ? input.value.trim() : '';
}

function setAuthStatus(message, type = '') {
  const status = document.getElementById('authStatus');
  if (!status) return;
  status.textContent = message;
  status.className = `status-message ${type}`.trim();
}

document.addEventListener('DOMContentLoaded', () => {
  if (!window.supabaseClient) return;
  initAuthPage();
});
