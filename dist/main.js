"use strict";
// main.ts – Expothèque InRealArt
// Lit notion_events.csv (à la racine), classe les événements (en cours / à venir), gère recherche + filtre ville.
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const MONTHS = {
    "janvier": 0, "janv.": 0, "jan.": 0,
    "février": 1, "fevrier": 1, "févr.": 1, "fevr.": 1, "feb.": 1,
    "mars": 2, "mars.": 2,
    "avril": 3, "avr.": 3,
    "mai": 4,
    "juin": 5,
    "juillet": 6, "juil.": 6,
    "août": 7, "aout": 7, "août.": 7, "aout.": 7,
    "septembre": 8, "sept.": 8,
    "octobre": 9, "oct.": 9,
    "novembre": 10, "nov.": 10,
    "décembre": 11, "decembre": 11, "déc.": 11, "dec.": 11
};
const today = new Date(); // date locale du navigateur
function $(sel) {
    const el = document.querySelector(sel);
    if (!el)
        throw new Error(`Élément introuvable: ${sel}`);
    return el;
}
/** CSV parser (gère quotes, virgules, CRLF, champs vides) */
function parseCSV(text) {
    const rows = [];
    let field = '', row = [];
    let i = 0, inQuotes = false;
    const pushField = () => { row.push(field); field = ''; };
    const pushRow = () => { rows.push(row); row = []; };
    while (i < text.length) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i += 2;
                    continue;
                } // échappement ""
                inQuotes = false;
                i++;
                continue;
            }
            else {
                field += c;
                i++;
                continue;
            }
        }
        else {
            if (c === '"') {
                inQuotes = true;
                i++;
                continue;
            }
            if (c === ',') {
                pushField();
                i++;
                continue;
            }
            if (c === '\n') {
                pushField();
                pushRow();
                i++;
                continue;
            }
            if (c === '\r') {
                if (text[i + 1] === '\n')
                    i++;
                pushField();
                pushRow();
                i++;
                continue;
            }
            field += c;
            i++;
        }
    }
    pushField();
    if (row.length > 1 || row[0] !== '')
        pushRow();
    const headers = rows.shift().map(h => h.trim());
    return rows
        .filter(r => r.some(x => String(x).trim() !== ''))
        .map(r => Object.fromEntries(headers.map((h, idx) => { var _a; return [h, ((_a = r[idx]) !== null && _a !== void 0 ? _a : '').trim()]; })));
}
/** Parse "4 septembre 2025" → Date (UTC 12:00) */
function parseDateFR(s) {
    if (!s)
        return null;
    let t = String(s).trim().replace(/\u2019/g, "'").replace(/\s+/g, ' ');
    const m = t.match(/^(\d{1,2})\s+([A-Za-zéèêëàâäîïôöùûüç\.]+)\s+(\d{4})$/i);
    if (!m)
        return null;
    const d = parseInt(m[1], 10);
    const monKey = m[2].toLowerCase();
    const mon = MONTHS[monKey];
    const y = parseInt(m[3], 10);
    if (mon == null)
        return null;
    return new Date(Date.UTC(y, mon, d, 12, 0, 0));
}
function fmtShort(date) {
    if (!date)
        return '';
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
        .format(date).replace(/\./g, '');
}
function between(dt, start, end) {
    if (!dt)
        return false;
    if (start && dt < start)
        return false;
    if (end && dt > end)
        return false;
    return true;
}
function slug(s) {
    return (s || '')
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}
/** Carte visuelle d’un événement */
function renderCard(ev) {
    const wrap = document.createElement('article');
    wrap.className = 'card';
    const title = ev['Titre'] || '(Sans titre)';
    const place = ev['Lieu'] || '';
    const desc = ev['Description'] || '';
    const datesRaw = ev['Dates'] || '';
    const start = parseDateFR(ev['start_date_text']);
    const end = parseDateFR(ev['end_date_text']);
    let badge = '';
    // Règles d’affichage validées :
    // En cours : today ∈ [start, end] OU "En cours" dans Dates ET end_date_text ≥ today
    const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0));
    if ((start && end && between(todayUTC, start, end)) ||
        (!start && /en cours/i.test(datesRaw) && end && todayUTC <= end)) {
        badge = 'En cours';
    }
    else if (start && todayUTC < start) {
        badge = 'À venir';
    }
    let datesDisplay = datesRaw;
    if (!datesDisplay) {
        if (start && end)
            datesDisplay = `Du ${fmtShort(start)} au ${fmtShort(end)}`;
        else if (start)
            datesDisplay = `À partir du ${fmtShort(start)}`;
        else if (end)
            datesDisplay = `Jusqu’au ${fmtShort(end)}`;
    }
    wrap.innerHTML = `
    <div class="card-head">
      <h3 class="title">${title}</h3>
      ${badge ? `<span class="badge">${badge}</span>` : ''}
    </div>
    <div class="meta">
      ${place ? `<span class="chip">📍 ${place}</span>` : ''}
      ${datesDisplay ? `<span class="chip">🗓️ ${datesDisplay}</span>` : ''}
    </div>
    ${desc ? `<p class="desc">${desc}</p>` : ''}
  `;
    return wrap;
}
function populateCityFilter(events) {
    const select = document.getElementById('city');
    const cities = Array.from(new Set(events.map(e => (e['Lieu'] || '').trim()).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b, 'fr'));
    cities.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c;
        select.appendChild(opt);
    });
}
function classifyAndSort(events) {
    const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0));
    const enhanced = events.map(ev => {
        const start = parseDateFR(ev['start_date_text']);
        const end = parseDateFR(ev['end_date_text']);
        let status = 'past';
        if ((start && end && between(todayUTC, start, end)) ||
            (!start && /en cours/i.test(ev['Dates'] || '') && end && todayUTC <= end)) {
            status = 'current';
        }
        else if (start && todayUTC < start) {
            status = 'upcoming';
        }
        else {
            status = 'past';
        }
        return { ev, start, end, status };
    });
    const current = enhanced
        .filter(e => e.status === 'current')
        .sort((a, b) => { var _a, _b; return (((_a = a.end) === null || _a === void 0 ? void 0 : _a.getTime()) || Infinity) - (((_b = b.end) === null || _b === void 0 ? void 0 : _b.getTime()) || Infinity); });
    const upcoming = enhanced
        .filter(e => e.status === 'upcoming')
        .sort((a, b) => { var _a, _b; return (((_a = a.start) === null || _a === void 0 ? void 0 : _a.getTime()) || Infinity) - (((_b = b.start) === null || _b === void 0 ? void 0 : _b.getTime()) || Infinity); });
    return { current, upcoming };
}
function renderLists(events) {
    const { current, upcoming } = classifyAndSort(events);
    const curWrap = $('#current-list');
    const upcWrap = $('#upcoming-list');
    curWrap.innerHTML = '';
    upcWrap.innerHTML = '';
    current.forEach(({ ev }) => curWrap.appendChild(renderCard(ev)));
    upcoming.forEach(({ ev }) => upcWrap.appendChild(renderCard(ev)));
    $('#current-empty').hidden = current.length > 0;
    $('#upcoming-empty').hidden = upcoming.length > 0;
}
/** Applique les filtres UI */
function applyFilters(allEvents) {
    const qInput = document.getElementById('q');
    const citySel = document.getElementById('city');
    const q = slug(qInput.value);
    const city = citySel.value;
    const filtered = allEvents.filter(ev => {
        const hay = slug(`${ev['Titre'] || ''} ${ev['Lieu'] || ''} ${ev['Description'] || ''}`);
        const matchQ = !q || hay.includes(q);
        const matchCity = !city || (ev['Lieu'] || '') === city;
        return matchQ && matchCity;
    });
    renderLists(filtered);
}
/** Boot */
function init() {
    return __awaiter(this, void 0, void 0, function* () {
        document.getElementById('year').textContent = String(new Date().getFullYear());
        try {
            // Résolution par rapport à la page (index.html à la racine)
            const csvURL = new URL('./notion_events.csv', document.baseURI).toString();
            const res = yield fetch(csvURL, { cache: 'no-store' });
            if (!res.ok) {
                throw new Error(`CSV introuvable (${res.status} ${res.statusText}) à ${res.url}`);
            }
            const txt = (yield res.text()).replace(/^\uFEFF/, ''); // retire BOM
            const events = parseCSV(txt);
            renderLists(events);
            populateCityFilter(events);
            const qInput = document.getElementById('q');
            const citySel = document.getElementById('city');
            const resetBtn = document.getElementById('reset');
            qInput.addEventListener('input', () => applyFilters(events));
            citySel.addEventListener('change', () => applyFilters(events));
            resetBtn.addEventListener('click', () => {
                qInput.value = '';
                citySel.value = '';
                applyFilters(events);
            });
        }
        catch (e) {
            console.error(e);
            const main = document.querySelector('main');
            if (main) {
                main.innerHTML = `<p class="empty">
        Impossible de charger le CSV. Vérifie que <code>notion_events.csv</code> est bien à la racine
        (même dossier que <code>index.html</code>) et que tu ouvres la page via un serveur local.
      </p>`;
            }
        }
    });
}
document.addEventListener('DOMContentLoaded', init);
