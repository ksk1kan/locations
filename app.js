/* FL Konum PWA - offline arama + Google Maps linki */
const BUILD_STAMP = "2026-01-21 10:32";

const STOPWORDS = new Set([
  "villa","vılla","apart","apartman","site","rezidans","residence","otel","hotel","pansiyon","bungalov","bungalow",
  "ev","evleri","house","club","garden","life","premium","lux","lüx","deluxe","boutique","butik","konak","suites","suite",
  "the","and","of","a","an","i̇","in"
]);

const el = (id) => document.getElementById(id);

function normalizeTR(input) {
  if (!input) return "";
  return input
    .toString()
    .trim()
    .toLowerCase("tr-TR")
    .replace(/ğ/g,"g").replace(/ü/g,"u").replace(/ş/g,"s").replace(/ı/g,"i").replace(/ö/g,"o").replace(/ç/g,"c")
    .replace(/[’'"`´^~]/g,"")
    .replace(/[^a-z0-9\s]/g," ")
    .replace(/\s+/g," ")
    .trim();
}

function tokenize(norm) {
  if (!norm) return [];
  return norm.split(" ").filter(Boolean).filter(t => !STOPWORDS.has(t));
}

function scoreLocation(queryNorm, qTokens, loc) {
  if (!queryNorm) return 0;

  let score = 0;
  const hay = loc._searchText;

  // Full substring match
  if (hay.includes(queryNorm)) score += 60;

  // Token matches
  for (const t of qTokens) {
    if (loc._tokens.has(t)) score += 14;
    else {
      // partial token match (e.g. "boy" -> "boyd")
      if (t.length >= 3 && hay.includes(t)) score += 6;
    }
  }

  // Prefix boost for single-word queries
  if (qTokens.length === 1) {
    const t = qTokens[0];
    if (t && loc._nameNorm.startsWith(t)) score += 25;
  }

  // Slight boost if region/type matches
  for (const t of qTokens) {
    if (loc._metaNorm.includes(t)) score += 2;
  }

  return score;
}

function escapeHtml(str) {
  return (str ?? "").toString()
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#039;");
}

async function loadLocations() {
  // Prefer embedded dataset (works even on file://). Fallback to fetch when hosted.
  let raw = (typeof window !== "undefined" && Array.isArray(window.LOCATIONS)) ? window.LOCATIONS : null;
  if (!raw) {
    const res = await fetch("./locations.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Konum verisi yüklenemedi.");
    raw = await res.json();
  }

  return raw.map((x) => {
    const ad = x.ad || "";
    const alt = Array.isArray(x.alternatifAdlar) ? x.alternatifAdlar : [];
    const bolge = x.bolge || "";
    const tur = x.tur || "";
    const giris = x.girisTarifi || "";

    const nameNorm = normalizeTR(ad);
    const metaNorm = normalizeTR([bolge, tur].filter(Boolean).join(" "));
    const searchParts = [ad, ...alt, bolge, tur, giris].filter(Boolean).join(" ");
    const searchText = normalizeTR(searchParts);
    const tokens = new Set(tokenize(searchText));

    return {
      ...x,
      alternatifAdlar: alt,
      _nameNorm: nameNorm,
      _metaNorm: metaNorm,
      _searchText: searchText,
      _tokens: tokens
    };
  });
}

function setBadge() {
  const online = navigator.onLine;
  const badge = el("netBadge");
  badge.textContent = online ? "Online" : "Offline";
  badge.className = "badge " + (online ? "good" : "warn");
}

function showToast(message, actionText, onAction) {
  const toast = el("toast");
  el("toastMsg").textContent = message;
  const btn = el("toastBtn");
  if (actionText) {
    btn.style.display = "inline-flex";
    btn.textContent = actionText;
    btn.onclick = onAction;
  } else {
    btn.style.display = "none";
    btn.onclick = null;
  }
  toast.classList.add("show");
}

function hideToast() {
  el("toast").classList.remove("show");
}

function copyText(text) {
  if (!text) return Promise.reject();
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(text);

  // Fallback
  return new Promise((resolve, reject) => {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand("copy");
      document.body.removeChild(ta);
      resolve();
    } catch (e) {
      document.body.removeChild(ta);
      reject(e);
    }
  });
}

function renderResults(results, query, total) {
  const list = el("list");
  list.innerHTML = "";

  el("countText").textContent = query
    ? `${results.length} sonuç (toplam ${total} kayıt)`
    : `Toplam ${total} kayıt`;

  const helper = el("helperText");
  if (!query) {
    helper.textContent = "Müşteri / villa / site / apart adını yaz. Örnek: “Boyd” veya “Villa Boyd”.";
  } else if (results.length === 0) {
    helper.textContent = "Eşleşme bulunamadı. Yazımı değiştir veya daha kısa dene.";
  } else if (results.length === 1) {
    helper.textContent = "Tek sonuç bulundu. Kartı açıp Google Maps’e geçebilirsin.";
  } else {
    helper.textContent = "Birden fazla sonuç bulundu. Doğru olanı seçmek için kartlardan birine dokun.";
  }

  for (const r of results) {
    const item = document.createElement("div");
    item.className = "item";
    item.dataset.id = r.id;

    const altText = (r.alternatifAdlar?.length)
      ? `<div class="alt">Alternatif: ${escapeHtml(r.alternatifAdlar.join(" • "))}</div>`
      : "";

    item.innerHTML = `
      <div class="itemHead" role="button" tabindex="0" aria-label="Konumu aç">
        <div class="left">
          <p class="name">${escapeHtml(r.ad || "")}</p>
          <div class="meta">
            ${r.bolge ? `<span class="pill">📍 ${escapeHtml(r.bolge)}</span>` : ""}
            ${r.tur ? `<span class="pill">🏷️ ${escapeHtml(r.tur)}</span>` : ""}
          </div>
        </div>
        <div class="score">Skor ${Math.round(r._score)}</div>
      </div>
      <div class="itemBody">
        <div class="actions">
          <a class="actionLink primary" href="${escapeHtml(r.googleMapsLink)}" target="_blank" rel="noopener">🗺️ Google Maps’te Aç</a>
          <button class="actionLink danger" type="button" data-copy="${escapeHtml(r.googleMapsLink)}">📋 Linki Kopyala</button>
        </div>
        ${altText}
        ${r.girisTarifi ? `<div class="alt">Tarif: ${escapeHtml(r.girisTarifi)}</div>` : ""}
      </div>
    `;

    // Toggle open
    const head = item.querySelector(".itemHead");
    head.addEventListener("click", () => toggleItem(item));
    head.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleItem(item);
      }
    });

    // Copy
    item.querySelectorAll("[data-copy]").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const link = btn.getAttribute("data-copy");
        try {
          await copyText(link);
          showToast("Link kopyalandı.", null);
          setTimeout(hideToast, 1500);
        } catch {
          showToast("Kopyalama başarısız. Linke uzun basıp kopyala.", null);
          setTimeout(hideToast, 2200);
        }
      });
    });

    list.appendChild(item);
  }
}

function toggleItem(item) {
  // Close other open items to keep UI clean on mobile
  document.querySelectorAll(".item.open").forEach(x => {
    if (x !== item) x.classList.remove("open");
  });
  item.classList.toggle("open");
}

function debounce(fn, ms=150) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

(async function init() {
  setBadge();
  window.addEventListener("online", setBadge);
  window.addEventListener("offline", setBadge);

  el("buildStamp").textContent = `Veri/Güncelleme: ${BUILD_STAMP}`;

  let locations = [];
  try {
    locations = await loadLocations();
  } catch (e) {
    console.error(e);
    showToast("Konum verisi yüklenemedi. İnternet var mı? (İlk kullanım için gerekli)", "Tekrar Dene", () => location.reload());
    return;
  }

  const input = el("q");
  const onSearch = debounce(() => {
    const query = input.value.trim();
    const qNorm = normalizeTR(query);
    const qTokens = tokenize(qNorm);

    if (!qNorm) {
      renderResults([], "", locations.length);
      return;
    }

    const scored = locations.map(l => {
      const sc = scoreLocation(qNorm, qTokens, l);
      return sc > 0 ? {...l, _score: sc} : null;
    }).filter(Boolean);

    scored.sort((a,b) => b._score - a._score || (a.ad || "").localeCompare((b.ad || ""), "tr"));
    const top = scored.slice(0, 30);
    renderResults(top, query, locations.length);
  }, 120);

  input.addEventListener("input", onSearch);
  el("clearBtn").addEventListener("click", () => {
    input.value = "";
    input.focus();
    renderResults([], "", locations.length);
  });

  el("searchBtn").addEventListener("click", () => {
    // trigger immediate search
    const event = new Event("input");
    input.dispatchEvent(event);
  });

  renderResults([], "", locations.length);

  // Service worker
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.register("./sw.js");
      // Update prompt
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            showToast("Yeni güncelleme hazır.", "Yenile", () => {
              newWorker.postMessage({ type: "SKIP_WAITING" });
            });
          }
        });
      });

      navigator.serviceWorker.addEventListener("message", (event) => {
        if (event.data?.type === "RELOAD") location.reload();
      });
    } catch (e) {
      console.warn("SW kayıt hatası", e);
    }
  }
})();
