function initTripDiaryComments() {
  const form = document.getElementById('tripCommentForm');
  const list = document.getElementById('tripCommentsList');
  const status = document.getElementById('tripCommentsStatus');

  if (!form || !list || !status) return;

  loadTripComments();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const nameInput = document.getElementById('tripCommentName');
    const commentInput = document.getElementById('tripCommentText');
    if (!nameInput || !commentInput) return;

    const name = nameInput.value.trim();
    const comment = commentInput.value.trim();

    if (!name || !comment) {
      setTripCommentsStatus('Please fill in both name and comment.', 'error');
      return;
    }

    setTripCommentsStatus('Saving…', 'loading');
    try {
      const { error } = await window.supabaseClient
        .from('trip_diary_comments')
        .insert([{ name, comment }]);

      if (error) throw error;

      form.reset();
      setTripCommentsStatus('Saved!', 'success');
      await loadTripComments();
    } catch (error) {
      console.error(error);
      setTripCommentsStatus('Something went wrong, please try again.', 'error');
    }
  });
}

async function loadTripComments() {
  const list = document.getElementById('tripCommentsList');
  if (!list) return;

  setTripCommentsStatus('Loading comments…', 'loading');
  list.innerHTML = '';

  try {
    const { data, error } = await window.supabaseClient
      .from('trip_diary_comments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!data || !data.length) {
      list.innerHTML = '<li>No comments yet. Be the first one!</li>';
      setTripCommentsStatus('');
      return;
    }

    data.forEach((item) => {
      const li = document.createElement('li');
      const name = document.createElement('strong');
      name.textContent = item.name;

      const text = document.createElement('p');
      text.textContent = item.comment;

      const time = document.createElement('small');
      time.textContent = formatDateTime(item.created_at);

      li.appendChild(name);
      li.appendChild(text);
      li.appendChild(time);
      list.appendChild(li);
    });

    setTripCommentsStatus('');
  } catch (error) {
    console.error(error);
    setTripCommentsStatus('Something went wrong, please try again.', 'error');
  }
}

function setTripCommentsStatus(message, type = '') {
  const status = document.getElementById('tripCommentsStatus');
  if (!status) return;
  status.textContent = message;
  status.className = `status-message ${type}`.trim();
}

function formatDateTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('et-EE', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(date);
}

document.addEventListener('DOMContentLoaded', () => {
  if (!window.supabaseClient) return;
  initTripDiaryComments();
});
