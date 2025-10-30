// Avatar Prerelease Box Picker — Vanilla JS (ES module)

const THEME_KEY = "avatar_theme";

// Character panels and Scryfall queries
const panels = {
  aang: {
    id: "panel-aang",
    tab: "tab-aang",
    url: "https://api.scryfall.com/cards/search?q=set%3Atla+t%3Acreature+aang&unique=cards&order=set",
    human: "https://scryfall.com/search?q=set%3Atla+t%3Acreature+aang&order=set"
  },
  katara: {
    id: "panel-katara",
    tab: "tab-katara",
    url: "https://api.scryfall.com/cards/search?q=set%3Atla+t%3Acreature+katara&unique=cards&order=set",
    human: "https://scryfall.com/search?q=set%3Atla+t%3Acreature+katara&order=set"
  },
  azula: {
    id: "panel-azula",
    tab: "tab-azula",
    url: "https://api.scryfall.com/cards/search?q=set%3Atla+t%3Acreature+azula&unique=cards&order=set",
    human: "https://scryfall.com/search?q=set%3Atla+t%3Acreature+azula&order=set"
  },
  zuko: {
    id: "panel-zuko",
    tab: "tab-zuko",
    url: "https://api.scryfall.com/cards/search?q=set%3Atla+t%3Acreature+zuko&unique=cards&order=set",
    human: "https://scryfall.com/search?q=set%3Atla+t%3Acreature+zuko&order=set"
  },
  toph: {
    id: "panel-toph",
    tab: "tab-toph",
    url: "https://api.scryfall.com/cards/search?q=set%3Atla+t%3Acreature+toph&unique=cards&order=set",
    human: "https://scryfall.com/search?q=set%3Atla+t%3Acreature+toph&order=set"
  }
};

// (Recommendation Wizard removed)

// Price format helper (USD)
function fmtUSD(str) {
  if (!str) return "";
  const num = Number(str);
  if (Number.isFinite(num)) return `$${num.toFixed(2)}`;
  return "$" + str;
}


// Fetch Scryfall with simple 429 backoff and sessionStorage caching of first page
async function fetchScryfall(url, opts = { signal: undefined }) {
  const cacheKey = `scryfall:${url}`;
  const cached = sessionStorage.getItem(cacheKey);
  if (cached) {
    try { return JSON.parse(cached); } catch { /* ignore */ }
  }

  const statusEl = opts.statusEl;
  const updateStatus = (msg) => { if (statusEl) statusEl.textContent = msg; };

  let delay = 800;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal: opts.signal });
      if (res.status === 429) {
        updateStatus(`Rate limited by Scryfall. Retrying in ${Math.round(delay/1000)}s…`);
        await new Promise(r => setTimeout(r, delay));
        delay *= 2;
        continue;
      }
      if (!res.ok) throw new Error(`Scryfall error ${res.status}`);
      const data = await res.json();
      // Cache only the first page for the base URL
      sessionStorage.setItem(cacheKey, JSON.stringify(data));
      return data;
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }
}

function cardImages(card) {
  if (card.image_uris?.normal) return { url: card.image_uris.normal, alt: card.name };
  if (Array.isArray(card.card_faces)) {
    const f = card.card_faces[0];
    if (f?.image_uris?.normal) return { url: f.image_uris.normal, alt: `${card.name} — ${f.name}` };
  }
  return { url: "", alt: card.name };
}

function renderCards(container, results = []) {
  const frag = document.createDocumentFragment();
  for (const c of results) {
    const { url, alt } = cardImages(c);
    const a = document.createElement("a");
    a.href = c.scryfall_uri || c.uri || "#";
    a.target = "_blank";
    a.rel = "noopener";
    a.title = c.type_line || c.name;

    const wrap = document.createElement("div");
    wrap.className = "card-item";
    const img = document.createElement("img");
    img.loading = "lazy";
    img.alt = alt || c.name;
    if (url) img.src = url;
    wrap.appendChild(img);
    
    // Price badge (if available)
    const price = c.prices?.usd || c.prices?.usd_foil || c.prices?.usd_etched;
    if (price) {
      const badge = document.createElement("span");
      badge.className = "price-badge";
      badge.textContent = fmtUSD(price);
      wrap.appendChild(badge);
    }

    a.appendChild(wrap);
    frag.appendChild(a);
  }
  container.appendChild(frag);
}

// Manage each panel: lazy load first page, enable Load more until done
function setupPanel(panelEl, url, humanUrl) {
  const statusEl = panelEl.querySelector(".status");
  const grid = panelEl.querySelector(".card-grid");
  const loadMoreBtn = panelEl.querySelector(".load-more");

  const state = { loaded: false, next: null, hasMore: false, controller: null };

  async function loadInitial() {
    if (state.loaded) return;
    statusEl.textContent = "Loading cards…";
    try {
      state.controller = new AbortController();
      const data = await fetchScryfall(url, { signal: state.controller.signal, statusEl });
      const results = data?.data || [];
      if (!results.length) {
        statusEl.innerHTML = `No results. Try <a href="${humanUrl}" target="_blank" rel="noopener">Scryfall search</a>.`;
        return;
      }
      renderCards(grid, results);
      state.hasMore = Boolean(data.has_more);
      state.next = data.next_page || null;
      loadMoreBtn.hidden = !state.hasMore;
      statusEl.textContent = `${results.length} cards revealed currently:`;
      state.loaded = true;
    } catch (err) {
      console.error(err);
      statusEl.innerHTML = `Couldn’t load Scryfall. <a href="${humanUrl}" target="_blank" rel="noopener">Open search</a>.`;
    }
  }

  async function loadMore() {
    if (!state.hasMore || !state.next) return;
    statusEl.textContent = "Loading more…";
    try {
      const res = await fetch(state.next);
      if (!res.ok) throw new Error("next_page failed");
      const data = await res.json();
      const results = data?.data || [];
      renderCards(grid, results);
      state.hasMore = Boolean(data.has_more);
      state.next = data.next_page || null;
      loadMoreBtn.hidden = !state.hasMore;
      statusEl.textContent = `Loaded ${grid.children.length} cards.`;
    } catch (err) {
      console.error(err);
      statusEl.textContent = "Couldn’t load more right now.";
    }
  }

  loadMoreBtn.addEventListener("click", loadMore);
  return { loadInitial };
}

// Gallery behavior: all five visible; lazy-load each as it enters viewport
function setupGallery() {
  const controllers = new Map();

  // Attach controllers for each panel
  for (const key of Object.keys(panels)) {
    const { id, url, human } = panels[key];
    const el = document.getElementById(id);
    if (!el) continue;
    controllers.set(id, setupPanel(el, url, human));
  }

  const observe = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const ctl = controllers.get(id);
    if (!ctl) return;
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            ctl.loadInitial();
            io.disconnect();
            break;
          }
        }
      }, { rootMargin: '150px' });
      io.observe(el);
    } else {
      // Fallback: load immediately
      ctl.loadInitial();
    }
  };

  // Observe all panels; Aang likely first in view
  Object.values(panels).forEach(p => observe(p.id));
}

// Theme toggle
function setupTheme() {
  const btn = document.getElementById("theme-toggle");
  const html = document.documentElement;

  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark" || saved === "light") {
    html.setAttribute("data-theme", saved);
  } else {
    // Default to light, but respect prefers-color-scheme if desired
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    html.setAttribute("data-theme", prefersDark ? "dark" : "light");
  }

  btn.addEventListener("click", () => {
    const cur = html.getAttribute("data-theme");
    const next = cur === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
  });
}

// (Recommendation Wizard removed)

function initFocus() {
  // Focus the main heading for screen readers
  const h1 = document.getElementById("site-title");
  if (h1) h1.focus();
}

function idlePrefetchAang() {
  const p = panels.aang;
  const cacheKey = `scryfall:${p.url}`;
  if (sessionStorage.getItem(cacheKey)) return; // already cached
  const prefetch = async () => {
    try { await fetch(p.url).then(r => r.json()).then(d => sessionStorage.setItem(cacheKey, JSON.stringify(d))); }
    catch { /* ignore */ }
  };
  if ("requestIdleCallback" in window) {
    requestIdleCallback(() => prefetch());
  } else {
    setTimeout(() => prefetch(), 1200);
  }
}

// Boot
window.addEventListener("DOMContentLoaded", () => {
  setupTheme();
  setupGallery();
  initFocus();
  idlePrefetchAang();
  setupArchetypeJumps();
});

// Clicking a character's archetype tag scrolls to and highlights the top archetype card
function setupArchetypeJumps() {
  const tags = document.querySelectorAll('.char-mapping .tag[data-arch]');
  const focusArchetype = (key) => {
    const id = `arch-${key}`;
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    target.classList.add('highlight');
    // Remove highlight after a moment
    setTimeout(() => target.classList.remove('highlight'), 2000);
  };
  tags.forEach(btn => {
    btn.addEventListener('click', () => focusArchetype(btn.dataset.arch));
    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); focusArchetype(btn.dataset.arch); }
    });
  });
}
