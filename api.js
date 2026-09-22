// TCGdex API wrapper — Italian locale
const BASE = 'https://api.tcgdex.net/v2/it';

// Simple in-memory cache
const cache = new Map();

async function fetchJson(url) {
  if (cache.has(url)) return cache.get(url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  cache.set(url, data);
  return data;
}

/** Get all sets */
async function getSets() {
  return fetchJson(`${BASE}/sets`);
}

/** Get a single set with all its cards */
async function getSet(id) {
  return fetchJson(`${BASE}/sets/${id}`);
}

/** Get full card detail (with pricing) */
async function getCard(id) {
  return fetchJson(`${BASE}/cards/${id}`);
}

/** Search cards by name */
async function searchCards(query) {
  // TCGdex supports query params for filtering
  const url = `${BASE}/cards?name=like:${encodeURIComponent(query)}`;
  return fetchJson(url);
}

/**
 * Get modern sets only (Scarlet & Violet era onwards, plus Mega Evolution era)
 * Sorted by most recent first
 */
async function getModernSets() {
  const allSets = await getSets();
  // Modern set IDs start with sv (Scarlet & Violet) or me (Megaevolution)
  const modern = allSets.filter(s => {
    const id = s.id;
    
    // Promos & Energie
    if (id === 'svp' || id === 'sve' || id === 'mep' || id === 'mee') return true;
    
    // 30° Anniversario
    if (id === '30th') return true;

    // Set europei ufficiali: sv o me seguiti da numeri (e opzionalmente decimali, es. me02.5)
    // Questo scarta in automatico le versioni giapponesi/asiatiche (sv10.5b, B1a, A2, ecc.)
    return /^(sv|me)\d+(\.\d+)?$/.test(id);
  });
  // reverse so newest first
  const reversed = modern.reverse();
  
  // Add "Prodotto Personalizzato" at the very beginning
  reversed.unshift({
      id: 'custom',
      name: 'Prodotto Personalizzato',
      logo: 'https://ui-avatars.com/api/?name=Personalizzato&background=23477d&color=fff&font-size=0.33', // Or any placeholder logo
      cardCount: { official: '∞', total: '∞' }
  });
  
  return reversed;
}

/** Format EUR price */
function formatPrice(val) {
  if (val == null || val === 0) return 'N/D';
  return `€${val.toFixed(2)}`;
}

/** Get card image URL (high quality) */
function cardImageUrl(imageBase) {
  return imageBase ? imageBase + '/high.webp' : '';
}

/** Get card image URL (low quality for thumbnails) */
function cardThumbUrl(imageBase) {
  return imageBase ? imageBase + '/low.webp' : '';
}

// --- Nuovo Sistema di Cache Locale Prezzi ---

let localPricesCache = null;

/** 
 * Get updated local prices data
 */
async function getLocalPrices() {
  if (localPricesCache) return localPricesCache;
  try {
    const res = await fetch('/data/it-prices.json');
    if (!res.ok) throw new Error('Prices non trovati');
    localPricesCache = await res.json();
    return localPricesCache;
  } catch (e) {
    console.warn('Impossibile caricare la cache dei prezzi locali (forse lo script non è stato eseguito).');
    return null;
  }
}

/** Get set logo URL */
function setLogoUrl(logoBase) {
  if (!logoBase) return null;
  return logoBase + '.webp';
}
