/* ══════════════════════════════════════════════
   GradassiStorage — Application Logic
   Firebase Firestore + Real-time Sync
   ══════════════════════════════════════════════ */

// ─── Firebase Configuration ───
const firebaseConfig = {
    apiKey: "AIzaSyDg3aL3PmhzkeInxnAOwt-N3qtVj8azNns",
    authDomain: "gradassistorage.firebaseapp.com",
    projectId: "gradassistorage",
    storageBucket: "gradassistorage.firebasestorage.app",
    messagingSenderId: "548495395151",
    appId: "1:548495395151:web:c9c6c25384c16b00ad5d3a"
};

// Initialize Firebase & Firestore
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Enable offline persistence (data available even without internet)
db.enablePersistence({ synchronizeTabs: true }).catch(err => {
    if (err.code === 'failed-precondition') {
        console.warn('Persistence failed: multiple tabs open');
    } else if (err.code === 'unimplemented') {
        console.warn('Persistence not supported by browser');
    }
});

const PRODUCTS_COLLECTION = 'products';

// ─── App Configuration ───
const CONFIG = {
    TYPES: [
        { value: 'booster-box', label: 'Booster Box', icon: '📦' },
        { value: 'etb', label: 'Elite Trainer Box (ETB)', icon: '🎁' },
        { value: 'display', label: 'Display', icon: '🗄️' },
        { value: 'collection-box', label: 'Collection Box', icon: '🎴' },
        { value: 'premium-collection', label: 'Premium Collection', icon: '👑' },
        { value: 'upc', label: 'Ultra Premium Collection (UPC)', icon: '💎' },
        { value: 'tin', label: 'Tin', icon: '🥫' },
        { value: 'blister', label: 'Blister Pack', icon: '🃏' },
        { value: 'booster-pack', label: 'Booster Pack', icon: '🃏' },
        { value: 'bundle', label: 'Bundle', icon: '🎀' },
        { value: 'mini-tin', label: 'Mini Tin', icon: '📎' },
        { value: 'special-box', label: 'Special Box', icon: '✨' },
        { value: 'build-battle', label: 'Build & Battle Box', icon: '⚔️' },
    ],
    LANGUAGES: [
        { value: 'it', label: 'Italiano', flag: '🇮🇹' },
        { value: 'en', label: 'Inglese', flag: '🇬🇧' },
        { value: 'ja', label: 'Giapponese', flag: '🇯🇵' },
        { value: 'ko', label: 'Coreano', flag: '🇰🇷' },
        { value: 'zh', label: 'Cinese', flag: '🇨🇳' },
        { value: 'fr', label: 'Francese', flag: '🇫🇷' },
        { value: 'de', label: 'Tedesco', flag: '🇩🇪' },
        { value: 'es', label: 'Spagnolo', flag: '🇪🇸' },
    ],
    CONDITIONS: [
        { value: 'sealed', label: 'Sigillato', class: 'badge-sealed' },
        { value: 'opened', label: 'Aperto', class: 'badge-opened' },
        { value: 'damaged', label: 'Danneggiato', class: 'badge-damaged' },
    ],
    CHART_COLORS: ['yellow', 'blue', 'green', 'red', 'purple', 'yellow', 'blue', 'green', 'red', 'purple'],
};

// ─── Utility Functions ───
function formatCurrency(amount) {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(amount);
}

function formatDate(iso) {
    return new Intl.DateTimeFormat('it-IT', {
        day: '2-digit', month: 'short', year: 'numeric',
    }).format(new Date(iso));
}

function getTypeInfo(value) {
    return CONFIG.TYPES.find(t => t.value === value) || { label: value, icon: '📦' };
}

function getLangInfo(value) {
    return CONFIG.LANGUAGES.find(l => l.value === value) || { label: value, flag: '🏳️' };
}

function getConditionInfo(value) {
    return CONFIG.CONDITIONS.find(c => c.value === value) || { label: value, class: 'badge-sealed' };
}

// ─── GradassiStorage Main Class ───
class PokeVault {
    constructor() {
        this.products = [];
        this.currentSection = 'dashboard';
        this.editingId = null;
        this.deleteId = null;
        this.isInitialLoad = true;
        this.localData = null;

        this.init();
    }

    // ── Initialization ──
    init() {
        this.populateSelects();
        this.bindEvents();
        this.initAutocomplete();
        this.setupFirestoreListener();
        
        // Preload images data
        getLocalPrices().then(data => {
            this.localData = data;
            if (this.currentSection === 'inventory') {
                this.renderInventory();
            }
        }).catch(e => console.error("Failed to load local data:", e));
    }

    // ── Firestore Real-time Listener ──
    setupFirestoreListener() {
        db.collection(PRODUCTS_COLLECTION)
            .orderBy('createdAt', 'desc')
            .onSnapshot(snapshot => {
                this.products = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Render current section (but don't reset add-product form)
                if (this.currentSection !== 'add-product') {
                    this.renderCurrentSection();
                }

                // Show connection toast on first load
                if (this.isInitialLoad) {
                    this.isInitialLoad = false;
                    const source = snapshot.metadata.fromCache ? 'cache locale' : 'cloud';
                    this.toast('info', '🔗', `Connesso al database (${source})`);
                }
            }, error => {
                console.error('Firestore listener error:', error);
                this.toast('error', '❌', 'Errore di connessione al database');
            });
    }

    populateSelects() {
        const typeSelects = ['form-type', 'edit-type', 'filter-type'];
        const langSelects = ['form-language', 'edit-language', 'filter-language'];
        const condSelects = ['form-condition', 'edit-condition', 'filter-condition'];

        typeSelects.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const isFilter = id.startsWith('filter-');
            if (!isFilter) el.innerHTML = '<option value="">Seleziona tipo...</option>';
            CONFIG.TYPES.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.value;
                opt.textContent = `${t.icon} ${t.label}`;
                el.appendChild(opt);
            });
        });

        langSelects.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const isFilter = id.startsWith('filter-');
            if (!isFilter) el.innerHTML = '<option value="">Seleziona lingua...</option>';
            CONFIG.LANGUAGES.forEach(l => {
                const opt = document.createElement('option');
                opt.value = l.value;
                opt.textContent = `${l.flag} ${l.label}`;
                el.appendChild(opt);
            });
        });

        condSelects.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const isFilter = id.startsWith('filter-');
            if (!isFilter) el.innerHTML = '<option value="">Seleziona condizione...</option>';
            CONFIG.CONDITIONS.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c.value;
                opt.textContent = c.label;
                el.appendChild(opt);
            });
        });
    }

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateTo(link.dataset.section);
            });
        });

        // Mobile sidebar
        document.getElementById('hamburger')?.addEventListener('click', () => this.toggleSidebar(true));
        document.getElementById('sidebar-close')?.addEventListener('click', () => this.toggleSidebar(false));
        document.getElementById('sidebar-overlay')?.addEventListener('click', () => this.toggleSidebar(false));

        // Search
        const searchInput = document.getElementById('search-input');
        const searchClear = document.getElementById('search-clear');
        searchInput?.addEventListener('input', () => {
            searchClear.style.display = searchInput.value ? 'flex' : 'none';
            this.renderInventory();
        });
        searchClear?.addEventListener('click', () => {
            searchInput.value = '';
            searchClear.style.display = 'none';
            this.renderInventory();
        });

        // Filters & Sort
        ['filter-type', 'filter-language', 'filter-condition', 'sort-select'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => this.renderInventory());
        });

        // Add Product Form
        document.getElementById('product-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleAddProduct();
        });
        document.getElementById('form-reset-btn')?.addEventListener('click', () => this.resetForm());

        // Edit Modal
        document.getElementById('edit-form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleEditProduct();
        });
        document.getElementById('modal-close')?.addEventListener('click', () => this.closeEditModal());
        document.getElementById('modal-cancel-btn')?.addEventListener('click', () => this.closeEditModal());
        document.getElementById('modal-delete-btn')?.addEventListener('click', () => this.openDeleteConfirm());

        // Close edit modal on overlay click
        document.getElementById('edit-modal-overlay')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closeEditModal();
        });

        // Delete Confirm Modal
        document.getElementById('delete-confirm-btn')?.addEventListener('click', () => this.handleDeleteProduct());
        document.getElementById('delete-cancel-btn')?.addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('delete-modal-close')?.addEventListener('click', () => this.closeDeleteModal());
        document.getElementById('delete-modal-overlay')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) this.closeDeleteModal();
        });

        // Export CSV
        document.getElementById('export-csv-btn')?.addEventListener('click', () => this.exportCSV());

        // Load Demo
        document.getElementById('load-demo-btn')?.addEventListener('click', () => this.loadDemoData());

        // Empty state buttons
        document.getElementById('empty-add-btn')?.addEventListener('click', () => this.navigateTo('wizard-sets'));
        document.getElementById('empty-demo-btn')?.addEventListener('click', () => this.loadDemoData());

        // Wizard back button
        document.getElementById('wizard-back-btn')?.addEventListener('click', () => {
            this.navigateTo('wizard-sets');
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeEditModal();
                this.closeDeleteModal();
                this.toggleSidebar(false);
                document.querySelectorAll('.autocomplete-dropdown').forEach(el => el.classList.remove('open'));
            }
        });

        // Close dropdowns on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.autocomplete-wrapper')) {
                document.querySelectorAll('.autocomplete-dropdown').forEach(el => el.classList.remove('open'));
            }
        });
    }

    // ── Autocomplete (TCGdex API & Local Prices) ──
    async initAutocomplete() {
        this.cachedSets = [];
        this.selectedSet = { form: null, edit: null };
        
        this.setupAutocompleteField('form');
        this.setupAutocompleteField('edit');
        this.setupProductAutocomplete('form');
        this.setupProductAutocomplete('edit');

        // Pre-carica dati in background
        try {
            if (typeof getModernSets === 'function') {
                const sets = await getModernSets();
                this.cachedSets = sets; // getModernSets reverses internally
            }
            if (typeof getLocalPrices === 'function') {
                await getLocalPrices();
            }
        } catch (error) {
            console.error('Error fetching API data:', error);
        }
    }

    setupAutocompleteField(prefix) {
        const input = document.getElementById(`${prefix}-expansion`);
        const dropdown = document.getElementById(`${prefix}-expansion-dropdown`);
        const preview = document.getElementById(`${prefix}-set-preview`);
        const productInput = document.getElementById(`${prefix}-name`);
        
        if (!input || !dropdown || !preview) return;

        let debounceTimeout;

        input.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            dropdown.classList.add('open');
            
            if (this.cachedSets.length === 0) {
                dropdown.innerHTML = '<div class="autocomplete-loading">Caricamento espansioni...</div>';
                return;
            }

            if (!query) {
                dropdown.classList.remove('open');
                return;
            }

            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                const matches = this.cachedSets.filter(set => 
                    set.name.toLowerCase().includes(query) || 
                    (set.id && set.id.toLowerCase().includes(query))
                ).slice(0, 15);

                if (matches.length === 0) {
                    dropdown.innerHTML = '<div class="autocomplete-empty">Nessuna espansione trovata</div>';
                    return;
                }

                dropdown.innerHTML = matches.map(set => `
                    <div class="autocomplete-item" data-id="${set.id}">
                        <img src="${setLogoUrl(set.logo)}" class="autocomplete-item-logo" alt="Logo" loading="lazy" onerror="this.style.display='none'">
                        <div class="autocomplete-item-info">
                            <div class="autocomplete-item-name">${this.escapeHtml(set.name)}</div>
                            <div class="autocomplete-item-meta">${set.cardCount ? set.cardCount.official + ' carte' : set.id}</div>
                        </div>
                    </div>
                `).join('');

                dropdown.querySelectorAll('.autocomplete-item').forEach((item, index) => {
                    item.addEventListener('click', () => {
                        this.selectSet(prefix, matches[index]);
                    });
                });
            }, 300);
        });
        
        preview.innerHTML = `
            <img src="" class="set-preview-logo" alt="">
            <div class="set-preview-info">
                <div class="set-preview-name"></div>
                <div class="set-preview-meta"></div>
            </div>
            <button type="button" class="set-preview-clear" title="Cambia Espansione">✖</button>
        `;
        
        preview.querySelector('.set-preview-clear').addEventListener('click', () => {
            preview.classList.remove('visible');
            input.value = '';
            input.style.display = 'block';
            input.focus();
            
            this.selectedSet[prefix] = null;
            productInput.disabled = true;
            productInput.value = '';
        });
    }

    async selectSet(prefix, set) {
        const input = document.getElementById(`${prefix}-expansion`);
        const dropdown = document.getElementById(`${prefix}-expansion-dropdown`);
        const preview = document.getElementById(`${prefix}-set-preview`);
        const productInput = document.getElementById(`${prefix}-name`);
        const typeSelect = document.getElementById(`${prefix}-type`);
        
        this.selectedSet[prefix] = set;
        dropdown.classList.remove('open');
        input.value = set.name;
        input.style.display = 'none';
        
        const logoImg = preview.querySelector('.set-preview-logo');
        logoImg.src = setLogoUrl(set.logo);
        logoImg.style.display = 'block';
        logoImg.onerror = () => logoImg.style.display = 'none';
        
        preview.querySelector('.set-preview-name').textContent = set.name;
        preview.querySelector('.set-preview-meta').textContent = set.id;
        preview.classList.add('visible');

        // Sblocca il campo prodotto
        productInput.disabled = false;
        productInput.placeholder = "Cerca carta o prodotto...";
        productInput.focus();

        // Autogenerate per prodotti sigillati standard
        const type = typeSelect.value;
        const typeInfo = getTypeInfo(type);
        if (type !== 'single-card' && (type === 'booster-box' || type === 'etb')) {
            const lang = document.getElementById(`${prefix}-language`).value;
            const langSuffix = lang ? ` (${lang.toUpperCase()})` : '';
            productInput.value = `${typeInfo.label} ${set.name}${langSuffix}`;
            
            // Pre-compila prezzo se disponibile nel tracker
            if (typeof getLocalPrices === 'function') {
                const prices = await getLocalPrices();
                if (prices && prices.sealed && prices.sealed[set.id]) {
                    const sData = prices.sealed[set.id];
                    const buyInput = document.getElementById(`${prefix}-buy-price`);
                    if (type === 'booster-box' && sData.bbPrice) buyInput.value = sData.bbPrice;
                    if (type === 'etb' && sData.etbPrice) buyInput.value = sData.etbPrice;
                }
            }
        }
    }

    setupProductAutocomplete(prefix) {
        const input = document.getElementById(`${prefix}-name`);
        const dropdown = document.getElementById(`${prefix}-product-dropdown`);
        
        if (!input || !dropdown) return;
        let debounceTimeout;

        input.addEventListener('input', async (e) => {
            const query = e.target.value.toLowerCase().trim();
            const set = this.selectedSet[prefix];
            const type = document.getElementById(`${prefix}-type`).value;
            
            // L'autocomplete ha senso principalmente se è una singola carta (o se si cerca genericamente)
            if (!set || query.length < 2) {
                dropdown.classList.remove('open');
                return;
            }

            dropdown.classList.add('open');
            dropdown.innerHTML = '<div class="autocomplete-loading">Ricerca carte nel set...</div>';

            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(async () => {
                try {
                    // Fetch full set details to get cards
                    const setDetails = await getSet(set.id);
                    if (!setDetails || !setDetails.cards) {
                        dropdown.innerHTML = '<div class="autocomplete-empty">Nessuna carta trovata nel set</div>';
                        return;
                    }

                    const matches = setDetails.cards.filter(c => 
                        c.name.toLowerCase().includes(query) || 
                        (c.localId && c.localId.toString() === query)
                    ).slice(0, 20);

                    if (matches.length === 0) {
                        dropdown.innerHTML = '<div class="autocomplete-empty">Nessuna carta corrispondente</div>';
                        return;
                    }

                    dropdown.innerHTML = matches.map(c => {
                        const thumb = c.image ? cardThumbUrl(c.image) : '';
                        return `
                        <div class="autocomplete-item" data-id="${c.id}" data-name="${this.escapeHtml(c.name)}">
                            ${thumb ? `<img src="${thumb}" class="autocomplete-item-logo" alt="Carta" loading="lazy" style="width:36px;height:50px;object-fit:cover;border-radius:2px;">` : ''}
                            <div class="autocomplete-item-info">
                                <div class="autocomplete-item-name">${this.escapeHtml(c.name)}</div>
                                <div class="autocomplete-item-meta">#${c.localId} · ${c.rarity || 'Comune'}</div>
                            </div>
                        </div>
                    `}).join('');

                    dropdown.querySelectorAll('.autocomplete-item').forEach((item, index) => {
                        item.addEventListener('click', () => {
                            input.value = matches[index].name + ` (#${matches[index].localId})`;
                            dropdown.classList.remove('open');
                            // Se c'è un campo note, potremmo salvare l'id della carta lì per riferimento
                            const notes = document.getElementById(`${prefix}-notes`);
                            if(notes && !notes.value.includes('TCGdex ID')) {
                                notes.value = `TCGdex ID: ${matches[index].id}\n` + notes.value;
                            }
                        });
                    });
                } catch (err) {
                    console.error('Error searching cards:', err);
                    dropdown.innerHTML = '<div class="autocomplete-empty">Errore nella ricerca</div>';
                }
            }, 500);
        });
    }

    // ── Navigation ──
    navigateTo(section) {
        this.currentSection = section;

        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        document.querySelector(`.nav-link[data-section="${section}"]`)?.classList.add('active');

        document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
        const sectionEl = document.getElementById(`section-${section}`);
        if (sectionEl) {
            sectionEl.classList.remove('active');
            void sectionEl.offsetHeight;
            sectionEl.classList.add('active');
        }

        this.toggleSidebar(false);
        this.renderCurrentSection();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    renderCurrentSection() {
        switch (this.currentSection) {
            case 'dashboard': this.renderDashboard(); break;
            case 'inventory': this.renderInventory(); break;
            case 'add-product': this.resetForm(); break;
            case 'stats': this.renderStats(); break;
            case 'wizard-sets': this.renderWizardSets(); break;
            case 'wizard-sealed': /* Managed via programmatic navigation */ break;
        }
    }

    // ── Wizard Flow ──
    async renderWizardSets() {
        const grid = document.getElementById('wizard-sets-grid');
        const subtitle = document.getElementById('wizard-sets-subtitle');
        if (!grid || !subtitle) return;
        
        if (this.cachedSets.length === 0) {
            grid.innerHTML = `
                <div class="stats-empty" style="grid-column: 1/-1;">
                    <div class="stats-empty-icon">⏳</div>
                    <p>Caricamento espansioni...</p>
                </div>
            `;
            // Aspetta un attimo se sta caricando
            await new Promise(r => setTimeout(r, 1000));
            if (this.cachedSets.length === 0) {
                 grid.innerHTML = `
                    <div class="stats-empty" style="grid-column: 1/-1;">
                        <div class="stats-empty-icon">⚠️</div>
                        <p>Impossibile caricare le espansioni. Controlla la connessione.</p>
                    </div>
                `;
                return;
            }
        }
        
        subtitle.textContent = `${this.cachedSets.length} espansioni moderne · Clicca per esplorare`;
        
        grid.innerHTML = this.cachedSets.map(s => `
            <div class="set-card" data-set="${s.id}">
                ${s.logo
                    ? `<img class="set-card-logo" src="${setLogoUrl(s.logo)}" alt="${s.name}" loading="lazy">`
                    : `<div class="set-card-logo" style="display:flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:700;opacity:0.6;">${s.name}</div>`
                }
                <div class="set-card-name">${s.name}</div>
                <div class="set-card-count">${s.cardCount?.official || s.cardCount?.total || '?'} carte</div>
            </div>
        `).join('');
        
        grid.querySelectorAll('.set-card').forEach(card => {
            card.addEventListener('click', () => {
                const setId = card.dataset.set;
                const setObj = this.cachedSets.find(s => s.id === setId);
                this.renderWizardSealed(setObj);
            });
        });
    }

    async renderWizardSealed(setObj) {
        if (!setObj) return;
        this.navigateTo('wizard-sealed');
        
        document.getElementById('wizard-sealed-title').textContent = setObj.name;
        const grid = document.getElementById('wizard-sealed-grid');
        
        grid.innerHTML = `
            <div class="stats-empty" style="grid-column: 1/-1;">
                <div class="stats-empty-icon">⏳</div>
                <p>Caricamento prodotti sigillati...</p>
            </div>
        `;

        let localData = null;
        if (typeof getLocalPrices === 'function') {
            localData = await getLocalPrices();
        }
        
        const sealedSet = (localData && localData.sealed) ? localData.sealed[setObj.id] : null;
        
        const products = [
            { type: 'booster-box', label: 'Booster Box', id: 'bb', priceProp: 'bbPrice', imageProp: 'bbImage' },
            { type: 'etb', label: 'Elite Trainer Box', id: 'etb', priceProp: 'etbPrice', imageProp: 'etbImage' },
            { type: 'bundle', label: 'Booster Bundle', id: 'bundle', priceProp: 'bundlePrice', imageProp: 'bundleImage' },
            { type: 'booster-pack', label: 'Booster Pack', id: 'pack', priceProp: 'packPrice', imageProp: 'packImage' },
            { type: 'blister', label: 'Blister (1/3 Pack)', id: 'blister', priceProp: 'blisterPrice', imageProp: 'blisterImage' },
            { type: 'mini-tin', label: 'Mini Tin', id: 'mini-tin', priceProp: 'miniTinPrice', imageProp: 'miniTinImage' },
            { type: 'tin', label: 'Tin', id: 'tin', priceProp: 'tinPrice', imageProp: 'tinImage' },
            { type: 'special-collection', label: 'Special Collection', id: 'special', priceProp: 'specialPrice', imageProp: 'specialImage' },
            { type: 'premium-collection', label: 'Premium Collection', id: 'premium', priceProp: 'premiumPrice', imageProp: 'premiumImage' },
            { type: 'upc', label: 'Ultra Premium Collection', id: 'upc', priceProp: 'upcPrice', imageProp: 'upcImage' },
            { type: 'build-and-battle', label: 'Build & Battle', id: 'bnb', priceProp: 'bnbPrice', imageProp: 'bnbImage' }
        ];

        let availableProducts = products;
        if (sealedSet) {
            // Mostra solo i prodotti di cui CardTrader ha trovato un'immagine (esistono davvero per questo set)
            const filtered = products.filter(prod => !!sealedSet[prod.imageProp]);
            if (filtered.length > 0) {
                availableProducts = filtered;
            }
        }

        let html = '';
        availableProducts.forEach(prod => {
            let price = null;
            let image = null;
            if (sealedSet) {
                price = sealedSet[prod.priceProp];
                image = sealedSet[prod.imageProp];
            }
            if (!image) {
                image = setObj.logo ? setLogoUrl(setObj.logo) : 'https://tcg.pokemon.com/assets/img/global/logos/logo-pokemon-tcg.png';
            }
            
            html += `
                <div class="sealed-card" data-type="${prod.type}" data-label="${prod.label}" data-price="${price || ''}">
                    <img src="${image}" alt="${prod.label}" loading="lazy" onerror="this.src='https://tcg.pokemon.com/assets/img/global/logos/logo-pokemon-tcg.png'; this.style.opacity=0.3;">
                    <h3>${prod.label}</h3>
                    <p>${setObj.name}</p>
                </div>
            `;
        });
        
        grid.innerHTML = html;
        
        grid.querySelectorAll('.sealed-card').forEach(card => {
            card.addEventListener('click', () => {
                const type = card.dataset.type;
                const price = card.dataset.price;
                this.openAddProductFromWizard(setObj, type, price);
            });
        });
    }

    openAddProductFromWizard(setObj, type, price) {
        this.navigateTo('add-product');
        
        const typeSelect = document.getElementById('form-type');
        typeSelect.value = type;
        
        // Simula la selezione dell'espansione tramite il nuovo autocomplete logica
        this.selectSet('form', setObj);
        
        // Sovrascrivi il prezzo se c'è dal tracker
        if (price) {
            document.getElementById('form-buy-price').value = price;
        }
    }

    toggleSidebar(open) {
        document.getElementById('sidebar')?.classList.toggle('open', open);
        document.getElementById('sidebar-overlay')?.classList.toggle('open', open);
        document.body.style.overflow = open ? 'hidden' : '';
    }

    // ══════════════════════════════════════════════
    // DASHBOARD
    // ══════════════════════════════════════════════
    renderDashboard() {
        const products = this.products;
        const totalQty = products.reduce((s, p) => s + p.quantity, 0);
        const totalValue = products.reduce((s, p) => s + (p.buyPrice * p.quantity), 0);
        const totalSellValue = products.reduce((s, p) => s + ((p.sellPrice || 0) * p.quantity), 0);
        const lowStockProducts = products.filter(p => p.quantity > 0 && p.quantity <= (p.lowStockThreshold || 2));
        const uniqueCount = products.length;

        const kpiGrid = document.getElementById('kpi-grid');
        kpiGrid.innerHTML = `
            <div class="kpi-card yellow">
                <div class="kpi-header">
                    <span class="kpi-label">Quantità Totale</span>
                    <div class="kpi-icon">📦</div>
                </div>
                <div class="kpi-value">${totalQty.toLocaleString('it-IT')}</div>
                <div class="kpi-sub">${uniqueCount} prodott${uniqueCount === 1 ? 'o' : 'i'} unic${uniqueCount === 1 ? 'o' : 'i'}</div>
            </div>
            <div class="kpi-card blue">
                <div class="kpi-header">
                    <span class="kpi-label">Valore Magazzino</span>
                    <div class="kpi-icon">💰</div>
                </div>
                <div class="kpi-value">${formatCurrency(totalValue)}</div>
                <div class="kpi-sub">Costo di acquisto</div>
            </div>
            <div class="kpi-card green">
                <div class="kpi-header">
                    <span class="kpi-label">Valore di Vendita</span>
                    <div class="kpi-icon">📈</div>
                </div>
                <div class="kpi-value">${formatCurrency(totalSellValue)}</div>
                <div class="kpi-sub">Potenziale di ricavo</div>
            </div>
            <div class="kpi-card red">
                <div class="kpi-header">
                    <span class="kpi-label">Scorte Basse</span>
                    <div class="kpi-icon">⚠️</div>
                </div>
                <div class="kpi-value">${lowStockProducts.length}</div>
                <div class="kpi-sub">Prodott${lowStockProducts.length === 1 ? 'o' : 'i'} sotto soglia</div>
            </div>
        `;

        // Recent Products (already sorted by createdAt desc from Firestore)
        const recentList = document.getElementById('recent-products-list');
        const recent = products.slice(0, 5);
        if (recent.length === 0) {
            recentList.innerHTML = '<div class="empty-list-msg">Nessun prodotto inserito</div>';
        } else {
            recentList.innerHTML = recent.map(p => {
                const type = getTypeInfo(p.type);
                return `
                    <div class="recent-item" data-id="${p.id}" onclick="app.openEditModal('${p.id}')" style="cursor:pointer">
                        <div class="recent-item-icon">${type.icon}</div>
                        <div class="recent-item-info">
                            <div class="recent-item-name">${this.escapeHtml(p.name)}</div>
                            <div class="recent-item-meta">${type.label} · ${formatDate(p.createdAt)}</div>
                        </div>
                        <div class="recent-item-qty">×${p.quantity}</div>
                    </div>
                `;
            }).join('');
        }

        // Low Stock
        const lowStockList = document.getElementById('low-stock-list');
        if (lowStockProducts.length === 0) {
            lowStockList.innerHTML = '<div class="empty-list-msg">✅ Nessun prodotto in esaurimento</div>';
        } else {
            lowStockList.innerHTML = lowStockProducts.map(p => {
                const type = getTypeInfo(p.type);
                return `
                    <div class="recent-item" data-id="${p.id}" onclick="app.openEditModal('${p.id}')" style="cursor:pointer">
                        <div class="recent-item-icon" style="background:var(--color-warning-dim)">${type.icon}</div>
                        <div class="recent-item-info">
                            <div class="recent-item-name">${this.escapeHtml(p.name)}</div>
                            <div class="recent-item-meta">Soglia: ${p.lowStockThreshold || 2}</div>
                        </div>
                        <div class="recent-item-qty" style="color:var(--color-warning)">×${p.quantity}</div>
                    </div>
                `;
            }).join('');
        }
    }

    // ══════════════════════════════════════════════
    // INVENTORY
    // ══════════════════════════════════════════════
    getFilteredProducts() {
        let filtered = [...this.products];

        // Search
        const search = (document.getElementById('search-input')?.value || '').toLowerCase().trim();
        if (search) {
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(search) ||
                (p.expansion || '').toLowerCase().includes(search) ||
                getTypeInfo(p.type).label.toLowerCase().includes(search)
            );
        }

        // Filters
        const filterType = document.getElementById('filter-type')?.value;
        const filterLang = document.getElementById('filter-language')?.value;
        const filterCond = document.getElementById('filter-condition')?.value;

        if (filterType) filtered = filtered.filter(p => p.type === filterType);
        if (filterLang) filtered = filtered.filter(p => p.language === filterLang);
        if (filterCond) filtered = filtered.filter(p => p.condition === filterCond);

        // Sort
        const sort = document.getElementById('sort-select')?.value || 'date-desc';
        filtered.sort((a, b) => {
            switch (sort) {
                case 'date-desc': return new Date(b.createdAt) - new Date(a.createdAt);
                case 'date-asc': return new Date(a.createdAt) - new Date(b.createdAt);
                case 'name-asc': return a.name.localeCompare(b.name, 'it');
                case 'name-desc': return b.name.localeCompare(a.name, 'it');
                case 'price-asc': return a.buyPrice - b.buyPrice;
                case 'price-desc': return b.buyPrice - a.buyPrice;
                case 'qty-asc': return a.quantity - b.quantity;
                case 'qty-desc': return b.quantity - a.quantity;
                default: return 0;
            }
        });

        return filtered;
    }

    renderInventory() {
        const filtered = this.getFilteredProducts();
        const grid = document.getElementById('product-grid');
        const emptyState = document.getElementById('empty-state');
        const countEl = document.getElementById('inventory-count');

        if (filtered.length === 0) {
            grid.style.display = 'none';
            emptyState.style.display = 'block';
            countEl.textContent = '';
            return;
        }

        grid.style.display = 'grid';
        emptyState.style.display = 'none';

        const totalFiltered = filtered.length;
        const totalQty = filtered.reduce((s, p) => s + p.quantity, 0);
        countEl.textContent = `${totalFiltered} prodott${totalFiltered === 1 ? 'o' : 'i'} · ${totalQty} pezzi totali`;

        grid.innerHTML = filtered.map((p, i) => {
            const type = getTypeInfo(p.type);
            const lang = getLangInfo(p.language);
            const cond = getConditionInfo(p.condition);
            const isLowStock = p.quantity > 0 && p.quantity <= (p.lowStockThreshold || 2);
            const profit = p.sellPrice ? (p.sellPrice - p.buyPrice) : null;

            // Try to find image from localData
            let imageUrl = null;
            if (this.localData && this.localData.sealed && typeof p.expansion === 'string') {
                // Find the set by name securely
                const setEntry = Object.values(this.localData.sealed).find(s => s && s.name && s.name.toLowerCase() === p.expansion.toLowerCase());
                if (setEntry) {
                    const typeMap = {
                        'booster-box': 'bbImage',
                        'etb': 'etbImage',
                        'bundle': 'bundleImage',
                        'booster-pack': 'packImage',
                        'blister': 'blisterImage',
                        'mini-tin': 'miniTinImage',
                        'tin': 'tinImage',
                        'special-box': 'specialImage',
                        'special-collection': 'specialImage',
                        'collection-box': 'specialImage',
                        'premium-collection': 'premiumImage',
                        'upc': 'upcImage',
                        'build-battle': 'bnbImage',
                        'build-and-battle': 'bnbImage'
                    };
                    const prop = typeMap[p.type];
                    if (prop && setEntry[prop]) {
                        imageUrl = setEntry[prop];
                    }
                }
            }

            return `
                <div class="product-card ${isLowStock ? 'low-stock' : ''}" style="animation-delay:${i * 0.04}s" data-id="${p.id}">
                    <div class="product-card-header">
                        ${imageUrl ? `<img src="${imageUrl}" class="product-card-image" alt="${this.escapeHtml(p.name)}" onerror="this.style.display='none'">` : `<div class="product-type-icon">${type.icon}</div>`}
                        <div class="product-card-title">
                            <div class="product-name">${this.escapeHtml(p.name)}</div>
                            ${p.expansion ? `<div class="product-expansion">${this.escapeHtml(p.expansion)}</div>` : ''}
                        </div>
                    </div>

                    <div class="product-badges">
                        <span class="badge badge-type">${type.label}</span>
                        <span class="badge badge-lang">${lang.flag} ${lang.label}</span>
                        <span class="badge ${cond.class}">${cond.label}</span>
                    </div>

                    <div class="product-details">
                        <div class="detail-item">
                            <div class="detail-label">Acquisto</div>
                            <div class="detail-value">${formatCurrency(p.buyPrice)}</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-label">Vendita</div>
                            <div class="detail-value">${p.sellPrice ? formatCurrency(p.sellPrice) : '—'}</div>
                        </div>
                        ${profit !== null ? `
                        <div class="detail-item">
                            <div class="detail-label">Margine</div>
                            <div class="detail-value ${profit >= 0 ? 'profit-positive' : 'profit-negative'}">
                                ${profit >= 0 ? '+' : ''}${formatCurrency(profit)}
                            </div>
                        </div>
                        ` : ''}
                        <div class="detail-item">
                            <div class="detail-label">Valore Tot.</div>
                            <div class="detail-value">${formatCurrency(p.buyPrice * p.quantity)}</div>
                        </div>
                    </div>

                    <div class="product-footer">
                        <div class="qty-controls">
                            <button class="qty-btn" onclick="app.adjustQty('${p.id}', -1)" title="Rimuovi 1">−</button>
                            <span class="qty-display">${p.quantity}</span>
                            <button class="qty-btn" onclick="app.adjustQty('${p.id}', 1)" title="Aggiungi 1">+</button>
                        </div>
                        <div class="product-actions">
                            <button class="btn-icon" onclick="app.openEditModal('${p.id}')" title="Modifica">✏️</button>
                            <button class="btn-icon danger" onclick="app.openDeleteConfirmDirect('${p.id}')" title="Elimina">🗑️</button>
                        </div>
                    </div>

                    ${p.notes ? `<div style="margin-top:var(--space-md);padding-top:var(--space-sm);border-top:1px solid rgba(255,255,255,0.04);font-size:var(--font-xs);color:var(--text-secondary)">📝 ${this.escapeHtml(p.notes)}</div>` : ''}
                </div>
            `;
        }).join('');
    }

    // ── Quick Quantity Adjust (Firestore) ──
    async adjustQty(id, delta) {
        const product = this.products.find(p => p.id === id);
        if (!product) return;

        const newQty = product.quantity + delta;
        if (newQty < 0) return;

        try {
            await db.collection(PRODUCTS_COLLECTION).doc(id).update({
                quantity: newQty,
                updatedAt: new Date().toISOString()
            });
            this.toast(
                delta > 0 ? 'success' : 'warning',
                delta > 0 ? '➕' : '➖',
                `${product.name}: quantità ${delta > 0 ? 'aumentata' : 'diminuita'} a ${newQty}`
            );
        } catch (error) {
            console.error('Error updating quantity:', error);
            this.toast('error', '❌', 'Errore nell\'aggiornamento della quantità');
        }
    }

    // ══════════════════════════════════════════════
    // ADD PRODUCT (Firestore)
    // ══════════════════════════════════════════════
    async handleAddProduct() {
        const name = document.getElementById('form-name').value.trim();
        const type = document.getElementById('form-type').value;
        const expansion = document.getElementById('form-expansion').value.trim();
        const language = document.getElementById('form-language').value;
        const condition = document.getElementById('form-condition').value;
        const buyPrice = parseFloat(document.getElementById('form-buy-price').value);
        const sellPrice = document.getElementById('form-sell-price').value ? parseFloat(document.getElementById('form-sell-price').value) : null;
        const quantity = parseInt(document.getElementById('form-quantity').value, 10);
        const lowStockThreshold = parseInt(document.getElementById('form-low-stock').value, 10) || 2;
        const notes = document.getElementById('form-notes').value.trim();

        // Validation
        if (!this.validateField('form-name', name) |
            !this.validateField('form-type', type) |
            !this.validateField('form-language', language) |
            !this.validateField('form-condition', condition) |
            !this.validateField('form-buy-price', !isNaN(buyPrice) && buyPrice >= 0) |
            !this.validateField('form-quantity', !isNaN(quantity) && quantity >= 0)) {
            this.toast('error', '❌', 'Compila tutti i campi obbligatori');
            return;
        }

        const productData = {
            name, type, expansion, language, condition,
            buyPrice, sellPrice, quantity, lowStockThreshold, notes,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        try {
            await db.collection(PRODUCTS_COLLECTION).add(productData);
            this.resetForm();
            this.toast('success', '✅', `"${name}" aggiunto al magazzino!`);
            this.navigateTo('inventory');
        } catch (error) {
            console.error('Error adding product:', error);
            this.toast('error', '❌', 'Errore nel salvataggio. Riprova.');
        }
    }

    // ══════════════════════════════════════════════
    // EDIT PRODUCT (Firestore)
    // ══════════════════════════════════════════════
    async handleEditProduct() {
        const id = document.getElementById('edit-id').value;
        if (!id) return;

        const name = document.getElementById('edit-name').value.trim();
        const type = document.getElementById('edit-type').value;
        const expansion = document.getElementById('edit-expansion').value.trim();
        const language = document.getElementById('edit-language').value;
        const condition = document.getElementById('edit-condition').value;
        const buyPrice = parseFloat(document.getElementById('edit-buy-price').value);
        const sellPrice = document.getElementById('edit-sell-price').value ? parseFloat(document.getElementById('edit-sell-price').value) : null;
        const quantity = parseInt(document.getElementById('edit-quantity').value, 10);
        const lowStockThreshold = parseInt(document.getElementById('edit-low-stock').value, 10) || 2;
        const notes = document.getElementById('edit-notes').value.trim();

        if (!name || !type || !language || !condition || isNaN(buyPrice) || isNaN(quantity)) {
            this.toast('error', '❌', 'Compila tutti i campi obbligatori');
            return;
        }

        try {
            await db.collection(PRODUCTS_COLLECTION).doc(id).update({
                name, type, expansion, language, condition,
                buyPrice, sellPrice, quantity, lowStockThreshold, notes,
                updatedAt: new Date().toISOString(),
            });
            this.closeEditModal();
            this.toast('success', '💾', `"${name}" aggiornato con successo!`);
        } catch (error) {
            console.error('Error updating product:', error);
            this.toast('error', '❌', 'Errore nell\'aggiornamento. Riprova.');
        }
    }

    validateField(fieldId, valid) {
        const el = document.getElementById(fieldId);
        if (!el) return !!valid;
        el.classList.toggle('invalid', !valid);
        return !!valid;
    }

    resetForm() {
        const form = document.getElementById('product-form');
        if (form) form.reset();
        document.getElementById('form-id').value = '';
        document.getElementById('form-quantity').value = '1';
        document.getElementById('form-low-stock').value = '2';
        document.querySelectorAll('#product-form .invalid').forEach(el => el.classList.remove('invalid'));

        document.getElementById('add-section-title').textContent = 'Aggiungi Prodotto';
        document.getElementById('add-section-subtitle').textContent = 'Inserisci un nuovo prodotto nel magazzino';
        document.getElementById('form-submit-btn').innerHTML = '<span>➕</span> Aggiungi Prodotto';
    }

    // ── Edit Modal ──
    openEditModal(id) {
        const product = this.products.find(p => p.id === id);
        if (!product) return;

        this.editingId = id;
        document.getElementById('edit-id').value = id;
        document.getElementById('edit-name').value = product.name;
        document.getElementById('edit-type').value = product.type;
        document.getElementById('edit-expansion').value = product.expansion || '';
        document.getElementById('edit-language').value = product.language;
        document.getElementById('edit-condition').value = product.condition;
        document.getElementById('edit-buy-price').value = product.buyPrice;
        document.getElementById('edit-sell-price').value = product.sellPrice || '';
        document.getElementById('edit-quantity').value = product.quantity;
        document.getElementById('edit-low-stock').value = product.lowStockThreshold || 2;
        document.getElementById('edit-notes').value = product.notes || '';
        document.getElementById('modal-title').textContent = `Modifica: ${product.name}`;

        document.getElementById('edit-modal-overlay').classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    closeEditModal() {
        document.getElementById('edit-modal-overlay')?.classList.remove('open');
        document.body.style.overflow = '';
        this.editingId = null;
    }

    // ── Delete (Firestore) ──
    openDeleteConfirm() {
        this.deleteId = this.editingId;
        const product = this.products.find(p => p.id === this.deleteId);
        if (!product) return;

        document.getElementById('delete-confirm-text').textContent =
            `Sei sicuro di voler eliminare "${product.name}"?`;
        document.getElementById('delete-modal-overlay').classList.add('open');
    }

    openDeleteConfirmDirect(id) {
        this.deleteId = id;
        const product = this.products.find(p => p.id === id);
        if (!product) return;

        document.getElementById('delete-confirm-text').textContent =
            `Sei sicuro di voler eliminare "${product.name}"?`;
        document.getElementById('delete-modal-overlay').classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    async handleDeleteProduct() {
        if (!this.deleteId) return;

        const product = this.products.find(p => p.id === this.deleteId);
        const name = product ? product.name : 'Prodotto';

        try {
            await db.collection(PRODUCTS_COLLECTION).doc(this.deleteId).delete();
            this.closeDeleteModal();
            this.closeEditModal();
            this.toast('warning', '🗑️', `"${name}" eliminato dal magazzino`);
        } catch (error) {
            console.error('Error deleting product:', error);
            this.toast('error', '❌', 'Errore nell\'eliminazione. Riprova.');
        }

        this.deleteId = null;
    }

    closeDeleteModal() {
        document.getElementById('delete-modal-overlay')?.classList.remove('open');
        if (!document.getElementById('edit-modal-overlay')?.classList.contains('open')) {
            document.body.style.overflow = '';
        }
    }

    // ══════════════════════════════════════════════
    // STATISTICS
    // ══════════════════════════════════════════════
    renderStats() {
        const products = this.products;

        if (products.length === 0) {
            document.getElementById('stats-summary').innerHTML = '';
            document.getElementById('stats-charts').innerHTML = `
                <div class="stats-empty">
                    <div class="stats-empty-icon">📊</div>
                    <p>Aggiungi prodotti per visualizzare le statistiche</p>
                </div>
            `;
            return;
        }

        const totalQty = products.reduce((s, p) => s + p.quantity, 0);
        const totalBuyValue = products.reduce((s, p) => s + (p.buyPrice * p.quantity), 0);
        const totalSellValue = products.reduce((s, p) => s + ((p.sellPrice || 0) * p.quantity), 0);
        const avgBuyPrice = totalQty > 0 ? totalBuyValue / totalQty : 0;
        const totalProfit = totalSellValue - totalBuyValue;

        document.getElementById('stats-summary').innerHTML = `
            <div class="stat-summary-card">
                <div class="stat-summary-label">Prodotti Unici</div>
                <div class="stat-summary-value">${products.length}</div>
            </div>
            <div class="stat-summary-card">
                <div class="stat-summary-label">Pezzi Totali</div>
                <div class="stat-summary-value">${totalQty.toLocaleString('it-IT')}</div>
            </div>
            <div class="stat-summary-card">
                <div class="stat-summary-label">Prezzo Medio Acq.</div>
                <div class="stat-summary-value">${formatCurrency(avgBuyPrice)}</div>
            </div>
            <div class="stat-summary-card">
                <div class="stat-summary-label">Margine Potenziale</div>
                <div class="stat-summary-value" style="color:${totalProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)'}">
                    ${totalProfit >= 0 ? '+' : ''}${formatCurrency(totalProfit)}
                </div>
            </div>
        `;

        const byType = this.groupBy(products, 'type');
        const byLang = this.groupBy(products, 'language');
        const byCond = this.groupBy(products, 'condition');

        document.getElementById('stats-charts').innerHTML = `
            <div class="chart-card">
                <div class="chart-title"><span>📊</span> Quantità per Tipo</div>
                ${this.renderBarChart(byType, 'quantity', p => getTypeInfo(p).label)}
            </div>
            <div class="chart-card">
                <div class="chart-title"><span>💰</span> Valore per Tipo</div>
                ${this.renderBarChart(byType, 'value', p => getTypeInfo(p).label, true)}
            </div>
            <div class="chart-card">
                <div class="chart-title"><span>🌐</span> Distribuzione per Lingua</div>
                ${this.renderDistribution(byLang, p => {
                    const info = getLangInfo(p);
                    return `${info.flag} ${info.label}`;
                })}
            </div>
            <div class="chart-card">
                <div class="chart-title"><span>📋</span> Distribuzione per Condizione</div>
                ${this.renderDistribution(byCond, p => getConditionInfo(p).label)}
            </div>
        `;

        requestAnimationFrame(() => {
            document.querySelectorAll('.bar-fill').forEach(bar => {
                const width = bar.dataset.width;
                bar.style.width = width;
            });
        });
    }

    groupBy(products, key) {
        const groups = {};
        products.forEach(p => {
            const val = p[key] || 'unknown';
            if (!groups[val]) groups[val] = [];
            groups[val].push(p);
        });
        return groups;
    }

    renderBarChart(groups, metric, labelFn, isCurrency = false) {
        const entries = Object.entries(groups).map(([key, items]) => {
            const value = metric === 'quantity'
                ? items.reduce((s, p) => s + p.quantity, 0)
                : items.reduce((s, p) => s + (p.buyPrice * p.quantity), 0);
            return { key, value, label: labelFn(key) };
        }).sort((a, b) => b.value - a.value);

        const maxValue = Math.max(...entries.map(e => e.value), 1);

        return `<div class="bar-chart">${entries.map((e, i) => {
            const pct = Math.max((e.value / maxValue) * 100, 8);
            const color = CONFIG.CHART_COLORS[i % CONFIG.CHART_COLORS.length];
            const displayValue = isCurrency ? formatCurrency(e.value) : e.value.toLocaleString('it-IT');
            return `
                <div class="bar-row">
                    <span class="bar-label" title="${e.label}">${e.label}</span>
                    <div class="bar-track">
                        <div class="bar-fill ${color}" data-width="${pct}%" style="width:0%">
                            <span class="bar-value">${displayValue}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('')}</div>`;
    }

    renderDistribution(groups, labelFn) {
        const entries = Object.entries(groups).map(([key, items]) => {
            const qty = items.reduce((s, p) => s + p.quantity, 0);
            return { key, qty, label: labelFn(key) };
        }).sort((a, b) => b.qty - a.qty);

        const total = entries.reduce((s, e) => s + e.qty, 0);
        const dotColors = ['#FFCB05', '#3D7DCA', '#4ecdc4', '#ff6b6b', '#a29bfe', '#ffa502', '#2ed573', '#ff6348'];

        return `<div class="distribution-list">${entries.map((e, i) => {
            const pct = total > 0 ? ((e.qty / total) * 100).toFixed(1) : 0;
            return `
                <div class="distribution-item">
                    <span class="distribution-dot" style="background:${dotColors[i % dotColors.length]}"></span>
                    <span class="distribution-label">${e.label}</span>
                    <span class="distribution-value">${e.qty}</span>
                    <span class="distribution-pct">${pct}%</span>
                </div>
            `;
        }).join('')}</div>`;
    }

    // ══════════════════════════════════════════════
    // EXPORT CSV
    // ══════════════════════════════════════════════
    exportCSV() {
        if (this.products.length === 0) {
            this.toast('warning', '⚠️', 'Nessun prodotto da esportare');
            return;
        }

        const headers = [
            'Nome', 'Tipo', 'Espansione', 'Lingua', 'Condizione',
            'Prezzo Acquisto (€)', 'Prezzo Vendita (€)', 'Quantità',
            'Soglia Scorta', 'Note', 'Data Inserimento', 'Ultimo Aggiornamento'
        ];

        const rows = this.products.map(p => [
            `"${p.name.replace(/"/g, '""')}"`,
            getTypeInfo(p.type).label,
            `"${(p.expansion || '').replace(/"/g, '""')}"`,
            getLangInfo(p.language).label,
            getConditionInfo(p.condition).label,
            p.buyPrice.toFixed(2),
            p.sellPrice ? p.sellPrice.toFixed(2) : '',
            p.quantity,
            p.lowStockThreshold || 2,
            `"${(p.notes || '').replace(/"/g, '""')}"`,
            p.createdAt,
            p.updatedAt,
        ]);

        const csv = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `gradassistorage_export_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);

        this.toast('success', '📥', 'Inventario esportato in CSV!');
    }

    // ══════════════════════════════════════════════
    // DEMO DATA (Firestore batch write)
    // ══════════════════════════════════════════════
    async loadDemoData() {
        const demoProducts = [
            {
                name: 'Booster Box Scarlet & Violet 151',
                type: 'booster-box', expansion: 'Scarlet & Violet — 151',
                language: 'ja', condition: 'sealed',
                buyPrice: 130, sellPrice: 185, quantity: 4,
                lowStockThreshold: 2, notes: 'Edizione giapponese, molto richiesta',
            },
            {
                name: 'Elite Trainer Box Crown Zenith',
                type: 'etb', expansion: 'Crown Zenith',
                language: 'en', condition: 'sealed',
                buyPrice: 55, sellPrice: 75, quantity: 6,
                lowStockThreshold: 3, notes: '',
            },
            {
                name: 'Display Ossidiana Infuocata',
                type: 'display', expansion: 'Ossidiana Infuocata',
                language: 'it', condition: 'sealed',
                buyPrice: 140, sellPrice: 165, quantity: 2,
                lowStockThreshold: 2, notes: 'Display da 36 buste',
            },
            {
                name: 'Ultra Premium Collection Charizard',
                type: 'upc', expansion: 'Sword & Shield',
                language: 'en', condition: 'sealed',
                buyPrice: 120, sellPrice: 210, quantity: 1,
                lowStockThreshold: 1, notes: 'Pezzo da collezione, alto valore',
            },
            {
                name: 'Booster Box Evolving Skies',
                type: 'booster-box', expansion: 'Evolving Skies',
                language: 'en', condition: 'sealed',
                buyPrice: 350, sellPrice: 460, quantity: 2,
                lowStockThreshold: 1, notes: 'Set molto ricercato, Eeveelutions',
            },
            {
                name: 'Tin Destini di Paldea',
                type: 'tin', expansion: 'Destini di Paldea',
                language: 'it', condition: 'sealed',
                buyPrice: 25, sellPrice: 35, quantity: 8,
                lowStockThreshold: 3, notes: '',
            },
            {
                name: 'Collection Box Paradox Rift',
                type: 'collection-box', expansion: 'Paradox Rift',
                language: 'en', condition: 'sealed',
                buyPrice: 45, sellPrice: 55, quantity: 3,
                lowStockThreshold: 2, notes: '',
            },
            {
                name: 'Bundle Forze Temporali',
                type: 'bundle', expansion: 'Forze Temporali',
                language: 'it', condition: 'sealed',
                buyPrice: 30, sellPrice: 42, quantity: 5,
                lowStockThreshold: 2, notes: 'Include 6 buste + promo',
            },
            {
                name: 'Booster Box Prismatic Evolutions',
                type: 'booster-box', expansion: 'Prismatic Evolutions',
                language: 'ja', condition: 'sealed',
                buyPrice: 92, sellPrice: 135, quantity: 3,
                lowStockThreshold: 2, notes: 'Set Eevee, edizione giapponese',
            },
            {
                name: 'ETB Scintille Travolgenti',
                type: 'etb', expansion: 'Scintille Travolgenti',
                language: 'it', condition: 'sealed',
                buyPrice: 45, sellPrice: 55, quantity: 7,
                lowStockThreshold: 3, notes: '',
            },
            {
                name: 'Premium Collection Celebrations',
                type: 'premium-collection', expansion: 'Celebrations',
                language: 'en', condition: 'sealed',
                buyPrice: 80, sellPrice: 125, quantity: 1,
                lowStockThreshold: 1, notes: '25° anniversario Pokémon',
            },
            {
                name: 'Display Paldea Evolved',
                type: 'display', expansion: 'Paldea Evolved',
                language: 'en', condition: 'opened',
                buyPrice: 135, sellPrice: null, quantity: 1,
                lowStockThreshold: 1, notes: 'Aperta per vendita singole buste',
            },
            {
                name: 'Booster Box Evoluzioni a Paldea',
                type: 'booster-box', expansion: 'Evoluzioni a Paldea',
                language: 'it', condition: 'sealed',
                buyPrice: 125, sellPrice: 150, quantity: 3,
                lowStockThreshold: 2, notes: '',
            },
            {
                name: 'Mini Tin Scarlet & Violet',
                type: 'mini-tin', expansion: 'Scarlet & Violet Base',
                language: 'en', condition: 'sealed',
                buyPrice: 8, sellPrice: 12, quantity: 15,
                lowStockThreshold: 5, notes: 'Assortimento vari artwork',
            },
            {
                name: 'Special Box Collezione Allenatore Fuoriclasse',
                type: 'special-box', expansion: 'Destini di Paldea',
                language: 'it', condition: 'damaged',
                buyPrice: 50, sellPrice: 35, quantity: 1,
                lowStockThreshold: 1, notes: 'Confezione leggermente danneggiata, sconto',
            },
        ];

        try {
            const batch = db.batch();
            const now = new Date();

            demoProducts.forEach((p, i) => {
                const ref = db.collection(PRODUCTS_COLLECTION).doc();
                const createdDate = new Date(now.getTime() - (i * 86400000 * Math.random() * 30));
                batch.set(ref, {
                    ...p,
                    createdAt: createdDate.toISOString(),
                    updatedAt: createdDate.toISOString(),
                });
            });

            await batch.commit();
            this.toast('success', '🎮', `${demoProducts.length} prodotti demo caricati nel cloud!`);
        } catch (error) {
            console.error('Error loading demo data:', error);
            this.toast('error', '❌', 'Errore nel caricamento dei dati demo');
        }
    }

    // ══════════════════════════════════════════════
    // TOAST NOTIFICATIONS
    // ══════════════════════════════════════════════
    toast(type, icon, message) {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${icon}</span>
            <span class="toast-message">${message}</span>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('out');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // ── Helpers ──
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ─── Initialize App ───
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new PokeVault();
});
