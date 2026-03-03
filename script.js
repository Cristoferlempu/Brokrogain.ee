// Gallery application - simple version
let supabaseClient;

document.addEventListener('DOMContentLoaded', function() {
    initSupabase();
    loadGallery();
});

function initSupabase() {
    const SUPABASE_URL = window.SUPABASE_URL;
    const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY;
    
    if (SUPABASE_URL && SUPABASE_ANON_KEY) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        });
        console.log('✅ Supabase initialized');
    } else {
        console.error('❌ Supabase credentials missing');
    }
}

async function loadGallery() {
    if (!supabaseClient) return;
    
    try {
        const { data, error } = await supabaseClient
            .from('gallery_posts')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('Fetch error:', error);
            return;
        }
        
        displayGallery(data || []);
    } catch (err) {
        console.error('Error loading gallery:', err);
    }
}

function displayGallery(posts) {
    const container = document.getElementById('galleryContainer');
    if (!container) return;
    
    // Clear existing gallery
    container.innerHTML = '';
    
    if (posts.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999;">Galerii on tühi. Ole esimene, kes pildi üles laadib!</p>';
        return;
    }
    
    posts.forEach(post => {
        const item = document.createElement('div');
        item.className = 'gallery-item';
        item.innerHTML = `
            <img src="${post.image_data}" alt="${post.title}" style="max-width: 100%; border-radius: 8px;">
            <div style="padding: 10px;">
                <h4>${post.title}</h4>
                <p style="color: #666; font-size: 14px;">${post.collection_name}</p>
            </div>
        `;
        container.appendChild(item);
    });
}

async function uploadImage() {
    const collectionInput = document.getElementById('collectionName');
    const fileInput = document.getElementById('imageInput');
    const titleInput = document.getElementById('imageTitle');
    const statusEl = document.getElementById('uploadStatus');
    
    if (!collectionInput.value.trim()) {
        statusEl.textContent = '❌ Sisesta kuupäev';
        return;
    }
    
    if (!fileInput.files[0]) {
        statusEl.textContent = '❌ Vali pilt';
        return;
    }
    
    if (!titleInput.value.trim()) {
        statusEl.textContent = '❌ Sisesta asukoht';
        return;
    }
    
    const file = fileInput.files[0];
    
    if (file.size > 5 * 1024 * 1024) {
        statusEl.textContent = '❌ Pilt on liiga suur (max 5MB)';
        return;
    }
    
    statusEl.textContent = '⏳ Laadin...';
    
    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const { error } = await supabaseClient
                .from('gallery_posts')
                .insert({
                    collection_name: collectionInput.value.trim(),
                    title: titleInput.value.trim(),
                    image_data: e.target.result,
                    created_at: new Date().toISOString()
                });
            
            if (error) {
                statusEl.textContent = '❌ Üleslaadimise viga: ' + error.message;
                return;
            }
            
            statusEl.textContent = '✅ Pilt üles laaditud!';
            collectionInput.value = '';
            fileInput.value = '';
            titleInput.value = '';
            
            setTimeout(() => {
                statusEl.textContent = '';
                loadGallery();
            }, 1000);
        } catch (err) {
            statusEl.textContent = '❌ Viga: ' + err.message;
        }
    };
    
    reader.readAsDataURL(file);
}
