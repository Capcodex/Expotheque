import 'dotenv/config';
import { promises as fs } from 'fs';
import { stringify } from 'csv-stringify/sync';

// --- Config de base ---
const TOKEN = process.env.NOTION_TOKEN!;
const DB_ID = process.env.NOTION_DATABASE_ID!;
if (!TOKEN || !DB_ID) throw new Error('NOTION_TOKEN ou NOTION_DATABASE_ID manquant');

const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  'Notion-Version': '2022-06-28', // stable & suffisant pour un test simple
  Accept: 'application/json',
  'Content-Type': 'application/json',
};

// --- Requête basique (pagination) ---
async function queryDatabase(databaseId: string) {
  const rows: any[] = [];
  let start_cursor: string | undefined = undefined;

  do {
    const res = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({ start_cursor, page_size: 100 }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Query failed ${res.status}: ${txt}`);
    }
    const json = await res.json();
    rows.push(...(json.results ?? []));
    start_cursor = json.next_cursor ?? undefined;
  } while (start_cursor);

  return rows;
}

// --- Helpers d’extraction simples ---
function joinPlain(arr: any[]) {
  return (arr ?? []).map((t: any) => t?.plain_text ?? '').join('').trim();
}
function propToString(p: any): string {
  if (!p || typeof p !== 'object') return '';
  switch (p.type) {
    case 'title':        return joinPlain(p.title);
    case 'rich_text':    return joinPlain(p.rich_text);
    case 'select':       return (p.select?.name ?? '').trim();
    case 'multi_select': return (p.multi_select ?? []).map((o: any) => o?.name ?? '').join(', ').trim();
    case 'date': {
      const s = p.date?.start ? String(p.date.start) : '';
      const e = p.date?.end ? String(p.date.end) : '';
      return s && e ? `${s} → ${e}` : (s || e || '');
    }
    case 'number':       return String(p.number ?? '');
    case 'checkbox':     return String(Boolean(p.checkbox));
    case 'url':          return p.url ?? '';
    case 'email':        return p.email ?? '';
    case 'phone_number': return p.phone_number ?? '';
    default:
      try { return JSON.stringify(p[p.type] ?? p); } catch { return ''; }
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
function pickRow(page: any) {
  const props = page.properties ?? {};
  const row: Record<string, string> = {};

  for (const name of PREFERRED_FIELDS) {
    const p = props[name];
    row[name] = p ? propToString(p) : '';
  }

  // Métadonnées utiles
  row['notion_page_id'] = page.id ?? '';
  row['notion_url'] = page.url ?? '';

  return row;
}

// --- Sauvegardes ---
async function saveJSON(rows: any[], path = 'notion_events.json') {
  await fs.writeFile(path, JSON.stringify(rows, null, 2), 'utf-8');
  console.log(`✅ JSON écrit: ${path}`);
}
async function saveCSV(rows: Record<string, string>[], path = 'notion_events.csv') {
  if (!rows.length) {
    console.log('⚠️ Aucune ligne à écrire.');
    return;
  }
  const columns = [...PREFERRED_FIELDS, 'notion_page_id', 'notion_url']; // ordre du CSV
  const csv = stringify(rows, { header: true, columns });
  await fs.writeFile(path, csv, 'utf-8');
  console.log(`✅ CSV écrit: ${path}`);
}

// --- Main ---
async function main() {
  console.log('⏳ Lecture Notion…');
  const pages = await queryDatabase(DB_ID);
  console.log(`📦 ${pages.length} pages`);

  // Aplatissement -> JSON lisible
  const flat = pages.map(pickRow);

  await saveJSON(flat, 'notion_events.json'); // optionnel mais pratique
  await saveCSV(flat, 'notion_events.csv');   // <— ton fichier demandé
  console.log('🎉 Terminé.');
}

main().catch((err) => {
  console.error('❌', err);
  process.exit(1);
});
