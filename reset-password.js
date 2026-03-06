function setResetStatus(message, type = '') {
  const status = document.getElementById('resetStatus');
  if (!status) return;
  status.textContent = message;
  status.className = `status-message ${type}`.trim();
}

function getRecoveryTokens() {
  const hashParams = new URLSearchParams((window.location.hash || '').replace(/^#/, ''));
  const queryParams = new URLSearchParams(window.location.search);

  const accessToken = hashParams.get('access_token') || queryParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token') || queryParams.get('refresh_token');
  const type = hashParams.get('type') || queryParams.get('type');

  return {
    accessToken,
    refreshToken,
    type,
    isRecovery: type === 'recovery' || Boolean(accessToken && refreshToken)
  };
}

function clearRecoveryUrlParams() {
  const cleanUrl = `${window.location.origin}${window.location.pathname}`;
  window.history.replaceState({}, document.title, cleanUrl);
}

async function initResetPasswordPage() {
  const form = document.getElementById('resetPasswordForm');
  const passwordInput = document.getElementById('newPassword');
  const confirmInput = document.getElementById('confirmPassword');

  if (!form || !passwordInput || !confirmInput || !window.supabaseClient) return;

  const { accessToken, refreshToken, isRecovery } = getRecoveryTokens();

  if (!isRecovery) {
    setResetStatus('Taastelink puudub või on vigane. Küsi uus link konto lehelt.', 'error');
    return;
  }

  if (accessToken && refreshToken) {
    const { error } = await window.supabaseClient.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    if (error) {
      setResetStatus('Taastelink on aegunud või vigane. Küsi uus link.', 'error');
      return;
    }
  }

  clearRecoveryUrlParams();
  form.hidden = false;
  setResetStatus('Sisesta uus parool.', 'info');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const newPassword = passwordInput.value.trim();
    const confirmPassword = confirmInput.value.trim();

    if (!newPassword || !confirmPassword) {
      setResetStatus('Täida mõlemad parooli väljad.', 'error');
      return;
    }

    if (newPassword.length < 6) {
      setResetStatus('Parool peab olema vähemalt 6 märki.', 'error');
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetStatus('Paroolid ei kattu.', 'error');
      return;
    }

    setResetStatus('Salvestan uut parooli…', 'loading');
    const { error } = await window.supabaseClient.auth.updateUser({ password: newPassword });

    if (error) {
      setResetStatus(error.message, 'error');
      return;
    }

    form.reset();
    setResetStatus('Parool uuendatud. Võid nüüd sisse logida konto lehel.', 'success');
    setTimeout(() => {
      window.location.href = 'auth.html';
    }, 1200);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initResetPasswordPage();
});
