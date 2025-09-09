"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fs_1 = require("fs");
const sync_1 = require("csv-stringify/sync");
// --- Config de base ---
const TOKEN = process.env.NOTION_TOKEN;
const DB_ID = process.env.NOTION_DATABASE_ID;
if (!TOKEN || !DB_ID)
    throw new Error('NOTION_TOKEN ou NOTION_DATABASE_ID manquant');
const HEADERS = {
    Authorization: `Bearer ${TOKEN}`,
    'Notion-Version': '2022-06-28', // stable & suffisant pour un test simple
    Accept: 'application/json',
    'Content-Type': 'application/json',
};
// --- Requête basique (pagination) ---
function queryDatabase(databaseId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        const rows = [];
        let start_cursor = undefined;
        do {
            const res = yield fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
                method: 'POST',
                headers: HEADERS,
                body: JSON.stringify({ start_cursor, page_size: 100 }),
            });
            if (!res.ok) {
                const txt = yield res.text();
                throw new Error(`Query failed ${res.status}: ${txt}`);
            }
            const json = yield res.json();
            rows.push(...((_a = json.results) !== null && _a !== void 0 ? _a : []));
            start_cursor = (_b = json.next_cursor) !== null && _b !== void 0 ? _b : undefined;
        } while (start_cursor);
        return rows;
    });
}
// --- Helpers d’extraction simples ---
function joinPlain(arr) {
    return (arr !== null && arr !== void 0 ? arr : []).map((t) => { var _a; return (_a = t === null || t === void 0 ? void 0 : t.plain_text) !== null && _a !== void 0 ? _a : ''; }).join('').trim();
}
function propToString(p) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    if (!p || typeof p !== 'object')
        return '';
    switch (p.type) {
        case 'title': return joinPlain(p.title);
        case 'rich_text': return joinPlain(p.rich_text);
        case 'select': return ((_b = (_a = p.select) === null || _a === void 0 ? void 0 : _a.name) !== null && _b !== void 0 ? _b : '').trim();
        case 'multi_select': return ((_c = p.multi_select) !== null && _c !== void 0 ? _c : []).map((o) => { var _a; return (_a = o === null || o === void 0 ? void 0 : o.name) !== null && _a !== void 0 ? _a : ''; }).join(', ').trim();
        case 'date': {
            const s = ((_d = p.date) === null || _d === void 0 ? void 0 : _d.start) ? String(p.date.start) : '';
            const e = ((_e = p.date) === null || _e === void 0 ? void 0 : _e.end) ? String(p.date.end) : '';
            return s && e ? `${s} → ${e}` : (s || e || '');
        }
        case 'number': return String((_f = p.number) !== null && _f !== void 0 ? _f : '');
        case 'checkbox': return String(Boolean(p.checkbox));
        case 'url': return (_g = p.url) !== null && _g !== void 0 ? _g : '';
        case 'email': return (_h = p.email) !== null && _h !== void 0 ? _h : '';
        case 'phone_number': return (_j = p.phone_number) !== null && _j !== void 0 ? _j : '';
        default:
            try {
                return JSON.stringify((_k = p[p.type]) !== null && _k !== void 0 ? _k : p);
            }
            catch (_l) {
                return '';
            }
    }
}
// Sélectionne uniquement les colonnes souhaitées (adapte ces noms à ta DB)
const PREFERRED_FIELDS = [
    'Titre',
    'Lieu',
    'Dates',
    'Description',
    'Catégorie',
    'start_date_text',
    'end_date_text',
];
// Construit une ligne plate (uniquement les colonnes ci-dessus + meta)
function pickRow(page) {
    var _a, _b, _c;
    const props = (_a = page.properties) !== null && _a !== void 0 ? _a : {};
    const row = {};
    for (const name of PREFERRED_FIELDS) {
        const p = props[name];
        row[name] = p ? propToString(p) : '';
    }
    // Métadonnées utiles
    row['notion_page_id'] = (_b = page.id) !== null && _b !== void 0 ? _b : '';
    row['notion_url'] = (_c = page.url) !== null && _c !== void 0 ? _c : '';
    return row;
}
// --- Sauvegardes ---
function saveJSON(rows_1) {
    return __awaiter(this, arguments, void 0, function* (rows, path = 'notion_events.json') {
        yield fs_1.promises.writeFile(path, JSON.stringify(rows, null, 2), 'utf-8');
        console.log(`✅ JSON écrit: ${path}`);
    });
}
function saveCSV(rows_1) {
    return __awaiter(this, arguments, void 0, function* (rows, path = 'notion_events.csv') {
        if (!rows.length) {
            console.log('⚠️ Aucune ligne à écrire.');
            return;
        }
        const columns = [...PREFERRED_FIELDS, 'notion_page_id', 'notion_url']; // ordre du CSV
        const csv = (0, sync_1.stringify)(rows, { header: true, columns });
        yield fs_1.promises.writeFile(path, csv, 'utf-8');
        console.log(`✅ CSV écrit: ${path}`);
    });
}
// --- Main ---
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('⏳ Lecture Notion…');
        const pages = yield queryDatabase(DB_ID);
        console.log(`📦 ${pages.length} pages`);
        // Aplatissement -> JSON lisible
        const flat = pages.map(pickRow);
        yield saveJSON(flat, 'notion_events.json'); // optionnel mais pratique
        yield saveCSV(flat, 'notion_events.csv'); // <— ton fichier demandé
        console.log('🎉 Terminé.');
    });
}
main().catch((err) => {
    console.error('❌', err);
    process.exit(1);
});
