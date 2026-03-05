function initAuthPage() {
  const registerForm = document.getElementById('registerForm');
  const loginForm = document.getElementById('loginForm');
  const logoutButton = document.getElementById('logoutButton');
  const status = document.getElementById('authStatus');
  const currentUser = document.getElementById('currentUser');

  if (!registerForm || !loginForm || !logoutButton || !status || !currentUser) return;

  refreshAuthState(currentUser, status);

  window.supabaseClient.auth.onAuthStateChange(() => {
    refreshAuthState(currentUser, status);
  });

  registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = readValue('registerEmail');
    const password = readValue('registerPassword');

    if (!email || !password) {
      setAuthStatus('Täida email ja parool.', 'error');
      return;
    }

    setAuthStatus('Loon kontot…', 'loading');
    const { error } = await window.supabaseClient.auth.signUp({ email, password });

    if (error) {
      setAuthStatus(error.message, 'error');
      return;
    }

    registerForm.reset();
    setAuthStatus('Konto loodud! Kontrolli vajadusel emaili kinnitust.', 'success');
  });

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const email = readValue('loginEmail');
    const password = readValue('loginPassword');

    if (!email || !password) {
      setAuthStatus('Täida email ja parool.', 'error');
      return;
    }

    setAuthStatus('Login…', 'loading');
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
}

async function refreshAuthState(currentUser, statusElement) {
  const { data, error } = await window.supabaseClient.auth.getUser();

  if (error) {
    setAuthStatus(error.message, 'error');
    currentUser.textContent = 'Pole sisse logitud';
    return;
  }

  if (!data.user) {
    currentUser.textContent = 'Pole sisse logitud';
    if (!statusElement.textContent) setAuthStatus('Logi sisse või loo konto.', 'info');
    return;
  }

  currentUser.textContent = `Sisse logitud: ${data.user.email}`;
  if (!statusElement.textContent || statusElement.className.includes('info')) {
    setAuthStatus('Autentimine aktiivne.', 'success');
  }
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
