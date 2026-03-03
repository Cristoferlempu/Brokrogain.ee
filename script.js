// Initialize gallery on page load
document.addEventListener('DOMContentLoaded', function() {
    // Only load gallery on galerii.html
    if (document.getElementById('collectionsContainer')) {
        loadGallery();
        if (!hasCloudGallery()) {
            showStatus('Pilvesalvestus pole seadistatud. Hetkel salvestub ainult sinu brauserisse.', 'error');
        } else {
            checkCloudConnection();
        }
    }

    // Allow Enter key for collection name and image title
    const collectionInput = document.getElementById('collectionName');
    if (collectionInput) {
        collectionInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                uploadImage();
            }
        });
    }

    const imageName = document.getElementById('imageName');
    if (imageName) {
        imageName.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                uploadImage();
            }
        });
    }
});

const GALLERY_STORAGE_KEY = 'galleryCollections';
const USER_ID_KEY = 'galleryUserId';
const SUPABASE_URL = window.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || '';
const SUPABASE_CLIENT = (window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY)
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false
        }
    })
    : null;

// Get or create unique user ID for this browser
function getUserId() {
    let userId = localStorage.getItem(USER_ID_KEY);
    if (!userId) {
        userId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem(USER_ID_KEY, userId);
    }
    return userId;
}

function hasCloudGallery() {
    return Boolean(SUPABASE_CLIENT);
}

function getSupabaseClient() {
    return SUPABASE_CLIENT;
}

function formatSupabaseError(error, fallbackMessage) {
    if (!error) {
        return fallbackMessage;
    }

    const details = [error.message, error.details, error.hint]
        .filter(Boolean)
        .join(' | ');

    return details ? `${fallbackMessage}: ${details}` : fallbackMessage;
}

function getStoredCollections() {
    try {
        const storedCollections = localStorage.getItem(GALLERY_STORAGE_KEY);
        if (!storedCollections) {
            return [];
        }

        const parsed = JSON.parse(storedCollections);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        return [];
    }
}

function saveCollections(collections) {
    localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(collections));
}

function createImageId() {
    return 'img-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

function buildCollectionsFromPosts(posts) {
    const grouped = {};

    posts.forEach(post => {
        const collectionName = post.collection_name;

        if (!grouped[collectionName]) {
            grouped[collectionName] = {
                id: collectionName,
                name: collectionName,
                date: post.created_at,
                updatedAt: post.created_at,
                images: []
            };
        }

        grouped[collectionName].images.push({
            id: post.id,
            title: post.title,
            image: post.image_data,
            createdAt: post.created_at,
            owner_id: post.owner_id
        });

        if (new Date(post.created_at) > new Date(grouped[collectionName].updatedAt)) {
            grouped[collectionName].updatedAt = post.created_at;
        }
    });

    return Object.values(grouped);
}

async function fetchCloudCollections() {
    const client = getSupabaseClient();
    if (!client) {
        console.log('No cloud client, using local');
        return getStoredCollections();
    }

    console.log('Fetching from cloud...');
    const { data, error } = await client
        .from('gallery_posts')
        .select('id, collection_name, title, image_data, created_at, owner_id')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Fetch error:', error);
        throw error;
    }

    console.log('Cloud query returned ' + (data ? data.length : 0) + ' rows');
    return buildCollectionsFromPosts(data || []);
}

async function checkCloudConnection() {
    if (!hasCloudGallery()) {
        return;
    }

    try {
        const client = getSupabaseClient();
        const { error } = await client
            .from('gallery_posts')
            .select('id')
            .limit(1);

        if (error) {
            showStatus(formatSupabaseError(error, 'Pilve ühendus ebaõnnestus'), 'error');
        }
    } catch (error) {
        showStatus('Pilve ühendus ebaõnnestus: võrguviga', 'error');
    }
}

// Load gallery with collections
async function loadGallery() {
    const container = document.getElementById('collectionsContainer');
    if (!container) {
        return;
    }

    let collections = [];
    let loadedFromCloud = false;

    try {
        collections = await fetchCloudCollections();
        if (collections.length > 0) {
            loadedFromCloud = true;
            console.log('Loaded ' + collections.length + ' collections from cloud');
        }
        saveCollections(collections);
    } catch (error) {
        console.error('Cloud load failed:', error);
        collections = getStoredCollections();
        if (hasCloudGallery()) {
            showStatus(formatSupabaseError(error, 'Pilveandmete laadimine ebaõnnestus. Kuvan viimast lokaalset versiooni'), 'error');
        }
    }

    // Clear container
    container.innerHTML = '';

    if (collections.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #6B7280; padding: 40px;">Kuupäevi veel ei ole. Lisa esimene pilt!</p>';
        if (loadedFromCloud) {
            console.log('Pilves pole andmeid');
        }
        return;
    }

    // Sort collections by updated date (newest first)
    collections.sort((a, b) => new Date(b.updatedAt || b.date) - new Date(a.updatedAt || a.date));

    console.log('About to render ' + collections.length + ' collections');

    // Display collections
    collections.forEach(collection => {
        console.log('Rendering collection:', collection.name, 'with', collection.images.length, 'images');
        const collectionDiv = document.createElement('div');
        collectionDiv.className = 'collection-item';
        collectionDiv.id = `collection-${collection.id}`;

        const headerDiv = document.createElement('div');
        headerDiv.className = 'collection-header';
        headerDiv.onclick = function() {
            collectionDiv.classList.toggle('collapsed');
        };

        const titleDiv = document.createElement('div');
        titleDiv.className = 'collection-title';

        const h3 = document.createElement('h3');
        h3.textContent = collection.name;

        const countSpan = document.createElement('span');
        countSpan.className = 'collection-count';
        countSpan.textContent = collection.images.length + ' pilt' + (collection.images.length === 1 ? '' : 'i');

        titleDiv.appendChild(h3);
        titleDiv.appendChild(countSpan);

        const rightDiv = document.createElement('div');
        rightDiv.style.display = 'flex';
        rightDiv.style.gap = '15px';
        rightDiv.style.alignItems = 'center';

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-collection-btn';
        deleteBtn.textContent = '✕ Kustuta kuupäev';
        deleteBtn.onclick = function(e) {
            e.stopPropagation();
            deleteCollection(collection.id);
        };

        const toggleSpan = document.createElement('span');
        toggleSpan.className = 'collection-toggle';
        toggleSpan.textContent = '▼';

        rightDiv.appendChild(deleteBtn);
        rightDiv.appendChild(toggleSpan);

        headerDiv.appendChild(titleDiv);
        headerDiv.appendChild(rightDiv);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'collection-content';

        const galleryDiv = document.createElement('div');
        galleryDiv.className = 'collection-gallery';

        collection.images.forEach(img => {
            const imageId = img.id || createImageId();
            const isOwner = !img.owner_id || img.owner_id === getUserId();

            const galleryItem = document.createElement('div');
            galleryItem.className = 'gallery-item';

            console.log('Creating gallery item:', { imageId, title: img.title, hasImage: Boolean(img.image), isOwner });

            const deleteButton = isOwner 
                ? `<button class="delete-btn" onclick="deleteImageFromCollection('${collection.id}', '${imageId}')">✕</button>`
                : '';

            galleryItem.innerHTML = `
                <img src="${img.image}" alt="${img.title}" class="gallery-image">
                <div class="gallery-overlay">
                    <p>${img.title}</p>
                </div>
                ${deleteButton}
            `;

            galleryDiv.appendChild(galleryItem);
        });

        contentDiv.appendChild(galleryDiv);
        collectionDiv.appendChild(headerDiv);
        collectionDiv.appendChild(contentDiv);

        container.appendChild(collectionDiv);
    });
}

// Upload image to collection
function uploadImage() {
    const collectionInput = document.getElementById('collectionName');
    const fileInput = document.getElementById('imageInput');
    const nameInput = document.getElementById('imageName');

    if (!collectionInput.value.trim()) {
        showStatus('Palun sisesta kuupäev!', 'error');
        return;
    }

    if (!fileInput.files[0]) {
        showStatus('Palun vali pilt!', 'error');
        return;
    }

    if (!nameInput.value.trim()) {
        showStatus('Palun sisesta asukoht!', 'error');
        return;
    }

    const file = fileInput.files[0];

    if (!file.type.startsWith('image/')) {
        showStatus('Palun vali piltfail (JPG, PNG jne)!', 'error');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        showStatus('Pilt on liiga suur! Max 5MB', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        const collectionName = collectionInput.value.trim();
        const imageTitle = nameInput.value.trim();
        const imageData = e.target.result;

        console.log('Upload starting. Cloud enabled:', hasCloudGallery());

        if (hasCloudGallery()) {
            console.log('Uploading to Supabase cloud...');
            try {
                const client = getSupabaseClient();
                const { error } = await client
                    .from('gallery_posts')
                    .insert({
                        collection_name: collectionName,
                        title: imageTitle,
                        image_data: imageData,
                        owner_id: getUserId()
                    });

                if (error) {
                    console.error('Cloud upload error:', error);
                    showStatus(formatSupabaseError(error, 'Pilvesse salvestamine ebaõnnestus'), 'error');
                    return;
                }

                console.log('Cloud upload success!');
                fileInput.value = '';
                nameInput.value = '';
                console.log('Reloading gallery from cloud...');
                await loadGallery();
                showStatus('✓ Pilt lisatud pilve ja kõigile nähtav! (pilvesalvestus töötas)', 'success');

                setTimeout(() => {
                    const statusMsg = document.getElementById('uploadStatus');
                    if (statusMsg) {
                        statusMsg.style.display = 'none';
                    }
                }, 3000);
                return;
            } catch (error) {
                console.error('Cloud upload exception:', error);
                showStatus('Pilvesse salvestamine ebaõnnestus: võrguviga.', 'error');
                return;
            }
        }

        console.log('Falling back to local storage...');
        let collections = getStoredCollections();
        let collection = collections.find(c => c.name === collectionName);

        if (collection) {
            collection.images.push({
                id: createImageId(),
                title: imageTitle,
                image: imageData
            });
            collection.date = new Date().toISOString();
            collection.updatedAt = new Date().toISOString();
        } else {
            collection = {
                id: 'collection-' + Date.now(),
                name: collectionName,
                date: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                images: [{
                    id: createImageId(),
                    title: imageTitle,
                    image: imageData
                }]
            };
            collections.push(collection);
        }

        collections = collections.slice(0, 50);

        try {
            saveCollections(collections);
        } catch (error) {
            showStatus('Salvestamine ebaõnnestus (mälu täis). Kustuta vanu pilte ja proovi uuesti.', 'error');
            return;
        }

        fileInput.value = '';
        nameInput.value = '';

        loadGallery();
        showStatus('✓ Pilt lisatud ainult SINU brauserisse (pilv ei tööta): ' + collectionName, 'success');

        setTimeout(() => {
            const statusMsg = document.getElementById('uploadStatus');
            if (statusMsg) {
                statusMsg.style.display = 'none';
            }
        }, 3000);
    };

    reader.readAsDataURL(file);
}

// Delete image from collection
async function deleteImageFromCollection(collectionId, imageId) {
    if (confirm('Kas oled kindel, et tahad selle pildi kustutada?')) {
        if (hasCloudGallery()) {
            try {
                const client = getSupabaseClient();
                const userId = getUserId();
                const { error } = await client
                    .from('gallery_posts')
                    .delete()
                    .eq('id', imageId)
                    .eq('owner_id', userId);

                if (error) {
                    showStatus(formatSupabaseError(error, 'Pildi kustutamine pilvest ebaõnnestus'), 'error');
                    return;
                }

                await loadGallery();
                showStatus('✓ Pilt kustutatud!', 'success');
                return;
            } catch (error) {
                showStatus('Pildi kustutamine pilvest ebaõnnestus: võrguviga.', 'error');
                return;
            }
        }

        let collections = getStoredCollections();
        const collection = collections.find(c => c.id === collectionId);

        if (collection) {
            collection.images = collection.images.filter(img => (img.id || '') !== imageId);

            if (collection.images.length === 0) {
                collections = collections.filter(c => c.id !== collectionId);
            }

            saveCollections(collections);
            loadGallery();

            showStatus('✓ Pilt kustutatud!', 'success');

            setTimeout(() => {
                const status = document.getElementById('uploadStatus');
                if (status) {
                    status.style.display = 'none';
                }
            }, 2000);
        }
    }
}

// Delete entire collection
async function deleteCollection(collectionId) {
    if (confirm('Kas oled kindel, et tahad kustutada selle kuupäeva kõik pildid?')) {
        if (hasCloudGallery()) {
            try {
                const client = getSupabaseClient();
                const { error } = await client
                    .from('gallery_posts')
                    .delete()
                    .eq('collection_name', collectionId);

                if (error) {
                    showStatus(formatSupabaseError(error, 'Kuupäeva piltide kustutamine pilvest ebaõnnestus'), 'error');
                    return;
                }

                await loadGallery();
                showStatus('✓ Kuupäeva pildid kustutatud!', 'success');
                return;
            } catch (error) {
                showStatus('Kuupäeva piltide kustutamine pilvest ebaõnnestus: võrguviga.', 'error');
                return;
            }
        }

        let collections = getStoredCollections();
        collections = collections.filter(c => c.id !== collectionId);

        saveCollections(collections);
        loadGallery();

        showStatus('✓ Kuupäeva pildid kustutatud!', 'success');

        setTimeout(() => {
            const status = document.getElementById('uploadStatus');
            if (status) {
                status.style.display = 'none';
            }
        }, 2000);
    }
}

// Show status message
function showStatus(message, type) {
    const statusMsg = document.getElementById('uploadStatus');
    if (!statusMsg) {
        return;
    }
    statusMsg.textContent = message;
    statusMsg.className = type;
    statusMsg.style.display = 'block';
}

// ----- hiking list functionality -----

// run on retked.html load
if (document.getElementById('hikesContainer')) {
    document.addEventListener('DOMContentLoaded', loadHikes);
}

function loadHikes() {
    const container = document.getElementById('hikesContainer');
    let hikes = [];
    const stored = localStorage.getItem('hikes');
    if (stored) hikes = JSON.parse(stored);
    // add default example if none stored
    if (hikes.length === 0) {
        hikes.push({
            date: '2026-03-01',
            distance: '8,5',
            difficulty: 'Lihtne–keskmine',
            description: 'Mõnus pühapäevane matk looduses',
            summary: 'Matk Valgejärvele',
            link: 'matk-valgejarvele.html',
            image: 'valgejarv.jpg'
        });
    }

    // sort newest first
    hikes.sort((a, b) => new Date(b.date) - new Date(a.date));

    container.innerHTML = '';

    if (hikes.length === 0) {
        container.innerHTML = '<p style="text-align:center;color:#6B7280;padding:30px;">Retki ei ole veel lisatud.</p>';
    }

    hikes.forEach(h => {
        const card = document.createElement('div');
        card.className = 'card';
        card.innerHTML = `
            <img src="${h.image||'valgejarv.jpg'}" alt="${h.summary||h.description}" class="card-image">
            <div class="card-content">
                <h3>${h.summary||h.description}</h3>
                <div class="card-meta">
                    <span>📍 ${h.distance} km</span>
                    <span>⭐ ${h.difficulty}</span>
                    <span>📅 ${new Date(h.date).toLocaleDateString('et-EE')}</span>
                </div>
                <p>${h.description}</p>
                <p><strong>Asukoht:</strong> ${h.location} <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(h.location)}" target="_blank">(vaata kaarti)</a></p>
                ${h.link?`<a href="${h.link}">Matka kogemused →</a>`:''}
            </div>
        `;
        container.appendChild(card);
    });
}

function addHike() {
    const dateInput = document.getElementById('hikeDate');
    const distInput = document.getElementById('hikeDistance');
    const diffInput = document.getElementById('hikeDifficulty');
    const descInput = document.getElementById('hikeSummary');
    const locInput = document.getElementById('hikeLocation');
    const linkInput = document.getElementById('hikeLink');
    const status = document.getElementById('hikeStatus');

    // initialize autocomplete if Google Places available
    if (window.google && google.maps && google.maps.places) {
        const locInput = document.getElementById('hikeLocation');
        new google.maps.places.Autocomplete(locInput, { types: ['geocode'] });
    }

    if (!dateInput.value) { showStatus2('Palun vali kuupäev','error'); return; }
    if (!distInput.value.trim()) { showStatus2('Palun sisesta kaugus','error'); return; }
    if (!diffInput.value.trim()) { showStatus2('Palun sisesta raskusaste','error'); return; }
    if (!descInput.value.trim()) { showStatus2('Palun kirjuta lühikirjeldus','error'); return; }
    // location optional but encourage
    if (!locInput.value.trim()) { showStatus2('Palun sisesta matka asukoht','error'); return; }

    let hikes = [];
    const stored = localStorage.getItem('hikes'); if (stored) hikes = JSON.parse(stored);
    hikes.unshift({
        date: dateInput.value,
        distance: distInput.value.trim(),
        difficulty: diffInput.value.trim(),
        description: descInput.value.trim(),
        summary: descInput.value.trim(),
        location: locInput.value.trim(),
        link: linkInput.value.trim(),
        image: ''
    });
    localStorage.setItem('hikes', JSON.stringify(hikes));
    loadHikes();
    showStatus2('Retk lisatud!','success');
    dateInput.value=''; distInput.value=''; diffInput.value=''; descInput.value=''; linkInput.value='';
    setTimeout(()=>status.style.display='none',3000);
}

function showStatus2(msg,type){
    const status=document.getElementById('hikeStatus');
    status.textContent=msg; status.className=type; status.style.display='block';
}