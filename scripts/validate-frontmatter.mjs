#!/usr/bin/env node
// Valide le frontmatter YAML des articles content/*.md — Wikilude (Geolude).
//
// Schéma attendu (README.md § Structure) :
//   category   (string, requis)  — doit faire partie de CATEGORIES ci-dessous,
//                                  source de vérité : App\Enums\WikiludeCategory
//                                  côté Geolude/platform. Si platform ajoute/
//                                  retire une rubrique, mettre à jour cette liste.
//   title      (string, requis)
//   excerpt    (string, requis)  — une phrase, affichée sur l'index
//   position   (int, requis)     — unique au sein de sa category
//   published  (bool, requis)
//
// Usage : node validate-frontmatter.mjs [fichiers...]   (défaut : content/*.md)

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const CATEGORIES = [
  'demarrer',
  'cycles',
  'nation-societe',
  'guerre-diplomatie',
  'progres-ressources',
  'gouvernance',
  'communaute',
];

const REQUIRED_KEYS = ['category', 'title', 'excerpt', 'position', 'published'];

function parseFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n/);
  if (!m) return null;
  const fm = {};
  for (const line of m[1].split('\n')) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const kv = line.match(/^([a-zA-Z_]+):\s*(.*)$/);
    if (!kv) continue;
    fm[kv[1]] = kv[2].replace(/\s+#.*$/, '').trim();
  }
  return fm;
}

function validateFile(file) {
  const text = readFileSync(file, 'utf8');
  const fm = parseFrontmatter(text);
  const errors = [];

  if (!fm) {
    return [`frontmatter YAML manquant ou mal formé (bloc --- ... --- attendu en tête de fichier)`];
  }

  for (const key of REQUIRED_KEYS) {
    if (!(key in fm) || fm[key] === '') errors.push(`champ requis manquant : ${key}`);
  }

  if (fm.category && !CATEGORIES.includes(fm.category)) {
    errors.push(`category invalide : "${fm.category}" (attendu : ${CATEGORIES.join(', ')})`);
  }

  if (fm.position !== undefined && !/^\d+$/.test(fm.position)) {
    errors.push(`position doit être un entier, reçu : "${fm.position}"`);
  }

  if (fm.published !== undefined && !['true', 'false'].includes(fm.published)) {
    errors.push(`published doit être true ou false, reçu : "${fm.published}"`);
  }

  if (fm.excerpt && fm.excerpt.length > 160) {
    errors.push(`excerpt trop long (${fm.excerpt.length} car., visé ~1 phrase courte)`);
  }

  return errors;
}

const args = process.argv.slice(2);
const files = args.length
  ? args
  : readdirSync('content').filter((f) => f.endsWith('.md')).map((f) => join('content', f));

let failed = 0;
const positionsByCategory = {};

for (const file of files) {
  const errors = validateFile(file);
  if (errors.length) {
    failed++;
    console.log(`✗ ${file}`);
    for (const e of errors) console.log(`    ${e}`);
  } else {
    const text = readFileSync(file, 'utf8');
    const fm = parseFrontmatter(text);
    const key = fm.category;
    positionsByCategory[key] ??= [];
    positionsByCategory[key].push({ file, position: fm.position });
  }
}

// Unicité de `position` au sein d'une même category.
for (const [category, entries] of Object.entries(positionsByCategory)) {
  const seen = new Map();
  for (const { file, position } of entries) {
    if (seen.has(position)) {
      console.log(`✗ position dupliquée dans "${category}" : ${position} (${seen.get(position)} et ${file})`);
      failed++;
    } else {
      seen.set(position, file);
    }
  }
}

if (failed) {
  console.log(`\n✗ ${failed} problème(s) sur ${files.length} fichier(s).`);
  process.exit(1);
} else {
  console.log(`✓ Frontmatter valide sur ${files.length} fichier(s).`);
}
