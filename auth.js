function initAuthPage() {
  const registerForm = document.getElementById('registerForm');
  const loginForm = document.getElementById('loginForm');
  const recoveryForm = document.getElementById('recoveryForm');
  const logoutButton = document.getElementById('logoutButton');
  const status = document.getElementById('authStatus');
  const currentUser = document.getElementById('currentUser');
  const registerSection = document.getElementById('registerSection');
  const loginSection = document.getElementById('loginSection');
  const resetSection = document.getElementById('resetSection');
  const resetPasswordForm = document.getElementById('resetPasswordForm');
  const logoutSection = document.getElementById('logoutSection');
  const openStatsButton = document.getElementById('openStatsButton');
  const closeStatsButton = document.getElementById('closeStatsButton');
  const statsModal = document.getElementById('statsModal');
  const statsKilometers = document.getElementById('statsKilometers');
  const statsTripsCount = document.getElementById('statsTripsCount');
  const statsModalStatus = document.getElementById('statsModalStatus');

  if (!registerForm || !loginForm || !recoveryForm || !logoutButton || !status || !currentUser || !registerSection || !loginSection || !logoutSection) return;

  refreshAuthState(currentUser, status, registerSection, loginSection, logoutSection);
  showResetSuccessNotice(registerSection, loginSection, logoutSection);

  handleRecoveryCallback(resetSection, resetPasswordForm, registerSection, loginSection, logoutSection);

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

    const identity = readValue('loginUsername');
    const password = readValue('loginPassword');

    if (!identity || !password) {
      setAuthStatus('Täida username/email ja parool.', 'error');
      return;
    }

    setAuthStatus('Login…', 'loading');
    const email = await resolveEmailFromIdentity(identity);
    if (!email) {
      setAuthStatus('Selle username/emailiga kontot ei leitud.', 'error');
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

  recoveryForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const identity = readValue('recoveryIdentity');
    if (!identity) {
      setAuthStatus('Sisesta username või email.', 'error');
      return;
    }

    setAuthStatus('Saadan taastelinki…', 'loading');
    const email = await resolveEmailFromIdentity(identity);
    if (!email) {
      setAuthStatus('Selle username/emailiga kontot ei leitud.', 'error');
      return;
    }

    const redirectTo = getRecoveryRedirectUrl();
    const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, { redirectTo });

    if (error) {
      setAuthStatus(error.message, 'error');
      return;
    }

    recoveryForm.reset();
    setAuthStatus('Taastelink saadeti sinu emailile.', 'success');
  });

  if (resetPasswordForm) {
    resetPasswordForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const newPassword = readValue('resetPassword');
      const confirmPassword = readValue('resetPasswordConfirm');

      if (!newPassword || !confirmPassword) {
        setAuthStatus('Sisesta uus parool mõlemasse välja.', 'error');
        return;
      }

      if (newPassword.length < 6) {
        setAuthStatus('Parool peab olema vähemalt 6 märki.', 'error');
        return;
      }

      if (newPassword !== confirmPassword) {
        setAuthStatus('Paroolid ei kattu.', 'error');
        return;
      }

      setAuthStatus('Uuendan parooli…', 'loading');
      const { error } = await window.supabaseClient.auth.updateUser({ password: newPassword });

      if (error) {
        setAuthStatus(error.message, 'error');
        return;
      }

      resetPasswordForm.reset();
      clearRecoveryParamsFromUrl();
      setAuthStatus('Parool uuendatud. Nüüd saad sisse logida uue parooliga.', 'success');
      if (resetSection) resetSection.hidden = true;
      setAuthSections(false, registerSection, loginSection, logoutSection);
    });
  }

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

function getRecoveryRedirectUrl() {
  const liveAuthUrl = 'https://cristoferlempu.github.io/Brokrogain.ee/reset-password.html';
  return liveAuthUrl;
}

async function handleRecoveryCallback(resetSection, resetPasswordForm, registerSection, loginSection, logoutSection) {
  const hashParams = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
  const queryParams = new URLSearchParams(window.location.search);

  const type = hashParams.get('type') || queryParams.get('type');
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');
  const isRecovery = type === 'recovery' || Boolean(accessToken && refreshToken);

  if (!isRecovery) {
    if (resetSection) resetSection.hidden = true;
    return;
  }

  if (accessToken && refreshToken) {
    const { error } = await window.supabaseClient.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    if (error) {
      setAuthStatus('Taastelink on vigane või aegunud. Küsi uus link.', 'error');
      if (resetSection) resetSection.hidden = true;
      return;
    }
  }

  if (resetSection) resetSection.hidden = false;
  if (resetPasswordForm) resetPasswordForm.reset();
  setAuthSections(false, registerSection, loginSection, logoutSection);
  setAuthStatus('Taastelink avatud. Sisesta uus parool.', 'info');
}

function clearRecoveryParamsFromUrl() {
  const cleanPath = `${window.location.origin}${window.location.pathname}`;
  window.history.replaceState({}, document.title, cleanPath);
}

function showResetSuccessNotice(registerSection, loginSection, logoutSection) {
  const params = new URLSearchParams(window.location.search);
  if (params.get('reset') !== 'success') return;

  setAuthStatus('Parool uuendatud. Logi sisse uue parooliga.', 'success');
  setAuthSections(false, registerSection, loginSection, logoutSection);

  params.delete('reset');
  const query = params.toString();
  const cleanUrl = query
    ? `${window.location.pathname}?${query}`
    : window.location.pathname;
  window.history.replaceState({}, document.title, cleanUrl);
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

async function resolveEmailFromIdentity(identity) {
  const value = String(identity || '').trim().toLowerCase();
  if (!value) return null;
  if (value.includes('@')) return value;
  return getEmailByUsername(normalizeUsername(value));
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
