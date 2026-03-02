// Initialize gallery on page load
document.addEventListener('DOMContentLoaded', function() {
    // Only load gallery on galerii.html
    if (document.getElementById('collectionsContainer')) {
        loadGallery();
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

// Load gallery with collections
function loadGallery() {
    const container = document.getElementById('collectionsContainer');
    let collections = [];

    // Get stored collections
    const storedCollections = localStorage.getItem('galleryCollections');
    if (storedCollections) {
        collections = JSON.parse(storedCollections);
    }

    // Clear container
    container.innerHTML = '';

    if (collections.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #6B7280; padding: 40px;">Kuupäevi veel ei ole. Lisa esimene pilt!</p>';
        return;
    }

    // Sort collections by date (newest first)
    collections.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Display collections
    collections.forEach((collection, index) => {
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

        const dateDiv = document.createElement('div');
        dateDiv.className = 'collection-date';
        dateDiv.textContent = new Date(collection.date).toLocaleDateString('et-EE');

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

        // Add images to collection
        collection.images.forEach(img => {
            const galleryItem = document.createElement('div');
            galleryItem.className = 'gallery-item';

            galleryItem.innerHTML = `
                <img src="${img.image}" alt="${img.title}" class="gallery-image">
                <div class="gallery-overlay">
                    <p>${img.title}</p>
                </div>
                <button class="delete-btn" onclick="deleteImageFromCollection('${collection.id}', '${img.title}')">✕</button>
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
    const statusMsg = document.getElementById('uploadStatus');

    // Validate inputs
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

    // Check file type
    if (!file.type.startsWith('image/')) {
        showStatus('Palun vali piltfail (JPG, PNG jne)!', 'error');
        return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showStatus('Pilt on liiga suur! Max 5MB', 'error');
        return;
    }

    // Read file and convert to base64
    const reader = new FileReader();
    reader.onload = function(e) {
        const collectionName = collectionInput.value.trim();
        const imageTitle = nameInput.value.trim();
        const imageData = e.target.result;

        // Get existing collections
        let collections = [];
        const storedCollections = localStorage.getItem('galleryCollections');
        if (storedCollections) {
            collections = JSON.parse(storedCollections);
        }

        // Find existing collection with same name
        let collection = collections.find(c => c.name === collectionName);

        if (collection) {
            // Add image to existing collection
            collection.images.push({
                title: imageTitle,
                image: imageData
            });
            collection.date = new Date().toISOString(); // Update date
        } else {
            // Create new collection
            collection = {
                id: 'collection-' + Date.now(),
                name: collectionName,
                date: new Date().toISOString(),
                images: [{
                    title: imageTitle,
                    image: imageData
                }]
            };
            collections.push(collection);
        }

        // Limit to 50 collections/images total
        collections = collections.slice(0, 50);

        // Save to localStorage
        localStorage.setItem('galleryCollections', JSON.stringify(collections));

        // Clear form
        fileInput.value = '';
        nameInput.value = '';

        // Reload gallery
        loadGallery();

        // Show success message
        showStatus('✓ Pilt lisatud kuupäevale "' + collectionName + '"!', 'success');

        setTimeout(() => {
            statusMsg.style.display = 'none';
        }, 3000);
    };

    reader.readAsDataURL(file);
}

// Delete image from collection
function deleteImageFromCollection(collectionId, imageTitle) {
    if (confirm('Kas oled kindel, et tahad kustutada pilti "' + imageTitle + '"?')) {
        let collections = [];
        const storedCollections = localStorage.getItem('galleryCollections');

        if (storedCollections) {
            collections = JSON.parse(storedCollections);
        }

        // Find collection
        const collection = collections.find(c => c.id === collectionId);

        if (collection) {
            // Remove image
            collection.images = collection.images.filter(img => img.title !== imageTitle);

            // If collection is empty, remove it
            if (collection.images.length === 0) {
                collections = collections.filter(c => c.id !== collectionId);
            }

            // Save
            localStorage.setItem('galleryCollections', JSON.stringify(collections));

            // Reload gallery
            loadGallery();

            showStatus('✓ Pilt kustutatud!', 'success');

            setTimeout(() => {
                document.getElementById('uploadStatus').style.display = 'none';
            }, 2000);
        }
    }
}

// Delete entire collection
function deleteCollection(collectionId) {
    if (confirm('Kas oled kindel, et tahad kustutada selle kuupäeva kõik pildid?')) {
        let collections = [];
        const storedCollections = localStorage.getItem('galleryCollections');

        if (storedCollections) {
            collections = JSON.parse(storedCollections);
        }

        // Remove collection
        collections = collections.filter(c => c.id !== collectionId);

        // Save
        localStorage.setItem('galleryCollections', JSON.stringify(collections));

        // Reload gallery
        loadGallery();

        showStatus('✓ Kuupäeva pildid kustutatud!', 'success');

        setTimeout(() => {
            document.getElementById('uploadStatus').style.display = 'none';
        }, 2000);
    }
}

// Show status message
function showStatus(message, type) {
    const statusMsg = document.getElementById('uploadStatus');
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