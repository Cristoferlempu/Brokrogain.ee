function initBlogModule() {
  const form = document.getElementById('blogPostForm');
  const list = document.getElementById('blogPostsList');
  const status = document.getElementById('blogStatus');
  const authHint = document.getElementById('blogAuthHint');

  if (!form || !list || !status) return;

  loadBlogPosts();
  setupBlogAuth(form, authHint);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const user = await getCurrentUser();
    if (!user) {
      setBlogStatus('Logi sisse, et postitusi lisada.', 'error');
      return;
    }

    const payload = {
      title: readBlogValue('blogTitle'),
      author_name: readBlogValue('blogAuthorName') || null,
      excerpt: readBlogValue('blogExcerpt') || null,
      content: readBlogValue('blogContent')
    };

    if (!payload.title || !payload.content) {
      setBlogStatus('Please fill in title and content.', 'error');
      return;
    }

    setBlogStatus('Saving…', 'loading');

    try {
      const { error } = await window.supabaseClient.from('blog_posts').insert([payload]);
      if (error) throw error;

      form.reset();
      setBlogStatus('Saved!', 'success');
      await loadBlogPosts();
    } catch (error) {
      console.error(error);
      setBlogStatus('Something went wrong, please try again.', 'error');
    }
  });
}

async function setupBlogAuth(form, authHint) {
  const applyState = async () => {
    const user = await getCurrentUser();
    const isLoggedIn = Boolean(user);
    toggleFormEnabled(form, isLoggedIn);

    if (authHint) {
      authHint.textContent = isLoggedIn
        ? `Sisse logitud: ${user.email}`
        : 'Postituse lisamiseks logi sisse.';
      authHint.className = `status-message ${isLoggedIn ? 'success' : 'info'}`;
    }

    const authorInput = document.getElementById('blogAuthorName');
    if (isLoggedIn && authorInput && !authorInput.value.trim() && user.email) {
      authorInput.value = user.email.split('@')[0];
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

async function loadBlogPosts() {
  const list = document.getElementById('blogPostsList');
  if (!list) return;

  setBlogStatus('Loading data…', 'loading');
  list.innerHTML = '';

  try {
    const { data, error } = await window.supabaseClient
      .from('blog_posts')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    const canModerate = await isModeratorUser();

    if (!data || !data.length) {
      list.innerHTML = '<p class="gallery-loading">No blog posts yet.</p>';
      setBlogStatus('');
      return;
    }

    data.forEach((post) => {
      const article = document.createElement('article');
      article.className = 'blog-post';

      const title = document.createElement('h3');
      title.textContent = post.title;

      const meta = document.createElement('p');
      meta.className = 'blog-meta';
      meta.textContent = `${formatBlogDate(post.created_at)}${post.author_name ? ` · ${post.author_name}` : ''}`;

      const excerpt = document.createElement('p');
      excerpt.textContent = post.excerpt || '';

      const toggleButton = document.createElement('button');
      toggleButton.type = 'button';
      toggleButton.className = 'btn blog-toggle';
      toggleButton.textContent = 'Loe edasi';

      const fullContent = document.createElement('div');
      fullContent.className = 'blog-full-content';
      fullContent.hidden = true;
      fullContent.innerHTML = `<p>${escapeHtml(post.content).replace(/\n/g, '<br>')}</p>`;

      toggleButton.addEventListener('click', () => {
        const isHidden = fullContent.hidden;
        fullContent.hidden = !isHidden;
        toggleButton.textContent = isHidden ? 'Sulge' : 'Loe edasi';
      });

      article.appendChild(title);
      article.appendChild(meta);
      if (post.excerpt) article.appendChild(excerpt);
      article.appendChild(toggleButton);
      article.appendChild(fullContent);

      if (canModerate) {
        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.className = 'btn btn-danger';
        deleteButton.textContent = 'Kustuta';
        deleteButton.addEventListener('click', async () => {
          await deleteBlogPost(post.id);
        });
        article.appendChild(deleteButton);
      }

      list.appendChild(article);

      if (window.observeRevealTarget) window.observeRevealTarget(article);
    });

    setBlogStatus('');
  } catch (error) {
    console.error(error);
    setBlogStatus('Something went wrong, please try again.', 'error');
  }
}

async function deleteBlogPost(postId) {
  if (!postId) return;
  const confirmed = window.confirm('Kas kustutan selle blogipostituse?');
  if (!confirmed) return;

  setBlogStatus('Kustutan postitust…', 'loading');

  try {
    const { error } = await window.supabaseClient
      .from('blog_posts')
      .delete()
      .eq('id', postId);

    if (error) throw error;

    setBlogStatus('Postitus kustutatud.', 'success');
    await loadBlogPosts();
  } catch (error) {
    console.error(error);
    setBlogStatus('Kustutamine ebaõnnestus. Kontrolli moderaatori õiguseid.', 'error');
  }
}

function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function readBlogValue(id) {
  const input = document.getElementById(id);
  return input ? input.value.trim() : '';
}

function setBlogStatus(message, type = '') {
  const status = document.getElementById('blogStatus');
  if (!status) return;
  status.textContent = message;
  status.className = `status-message ${type}`.trim();
}

function formatBlogDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('et-EE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(date);
}

document.addEventListener('DOMContentLoaded', () => {
  if (!window.supabaseClient) return;
  initBlogModule();
});
