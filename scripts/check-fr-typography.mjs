#!/usr/bin/env node
// Linter de typographie française — Geolude (constellation).
// Source canonique : Geolude/docs · bin/check-fr-typography.mjs
// Copié dans chaque repo sous scripts/check-fr-typography.mjs (autonomie CI).
//
// Vérifie le « contenu français destiné à l'humain » (docs/12-CONVENTIONS.md
// § « Typographie française »). Détecte, ne corrige pas — la recomposition des
// guillemets et des incises (em-dash) demande du jugement.
//
// Règles vérifiées :
//   1. espace sécable (U+0020) avant : ; ! ?  → doit être U+00A0 (`:`) / U+202F (`;!?`)
//   2. apostrophe droite ' entre deux lettres → ’ (U+2019)
//   3. guillemets droits " ou anglais “ ” dans la prose → « … »
//   4. tiret cadratin — (U+2014) → incise en virgules/parenthèses/deux-points
//   5. point médian · (U+00B7) séparateur → virgule ou structure
//   6. puce unicode • ‣ ▪ (U+2022/2023/25AA) → tiret Markdown `-`
//
// Deux familles, deux niveaux d'exigence :
//   - Typo française classique (1-3, insécables/apostrophe/guillemets) : n'a de sens
//     que sur du texte réellement typeset pour un lecteur → prose .md, texte
//     Blade/HTML rendu. PAS dans les commentaires de code (jamais lus en rendu
//     typographique, faux positifs sur du jargon technique).
//   - Marqueurs IA (4-6, em-dash/point médian/puce unicode) : signal de contenu
//     généré non relu, vérifié PARTOUT y compris dans les commentaires de code.
//
// Périmètre par type de fichier (heuristique, pas un parseur complet) :
//   .md         prose hors blocs/inline de code, URLs, front-matter, ref-links
//   .blade.php  texte + {{-- commentaires --}} ; ignore {{ }}, {!! !!}, attributs de balises
//   .html/.htm  texte + <!-- commentaires --> ; ignore les balises (attributs)
//   .php        valeurs de chaînes (placeholders :name préservés) + commentaires
//
// Les placeholders i18n (`:name`, `:code`…) ne sont jamais signalés : la règle
// « espace avant : » ne mord que sur un `:` NON suivi d'un identifiant.
//
// Échappatoire : une ligne contenant `typo-ignore` est ignorée.
//
// Usage : node check-fr-typography.mjs [chemins...]   (défaut : répertoire courant)
//         node check-fr-typography.mjs --fix [chemins...]
//         node check-fr-typography.mjs --quotes [chemins...]
// `--fix` applique 4 familles de corrections, dans les mêmes régions que la
// vérification (jamais de code ni de placeholder touché) :
//   1. espace→insécable avant ':' '; ! ?' et apostrophe droite→’ (mono-caractère)
//   2. guillemets appariés « … » (`--quotes` seul seuil, régions impaires — nombre
//      impair de guillemets droits sur le fichier — laissées au manuel)
//   3. tiret cadratin et point médian séparateur recomposés en virgules
// Rien n'est donc plus jamais signalé sans tentative de correction automatique ;
// seules les régions ambiguës (guillemets impairs) restent pour traitement manuel.
// Sortie : liste fichier:ligne:col + règle ; code de sortie 1 si violations.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative, basename } from 'node:path';

const EXCLUDE_DIRS = new Set([
  '.git', 'vendor', 'node_modules', 'storage', 'dist', 'build',
  'bootstrap', 'public', '.idea', '.vscode', 'coverage', 'plans',
]);

const IGNORE_TOKEN = 'typo-ignore';

// --- Règles (regex sur une tranche de texte, drapeau u) ------------------------
const RULES = {
  spaceColon:  { re: / :(?![\p{L}\p{N}_])/gu, msg: "espace simple avant ':' (→ insécable U+00A0)" },
  spacePunct:  { re: / [;!?]/gu,              msg: "espace simple avant ';' '!' '?' (→ fine U+202F)" },
  apostrophe:  { re: /\p{L}'\p{L}/gu,         msg: "apostrophe droite ' (→ ’ U+2019)" },
  quotes:      { re: /["“”]/gu,               msg: 'guillemet droit/anglais (→ « … »)' },
  emDash:      { re: /—/gu,              msg: "tiret cadratin — (incise → virgules/parenthèses)" },
  // point médian SÉPARATEUR uniquement (adjacent à une espace) ; l'écriture
  // inclusive en milieu de mot (auteur·rice) n'est pas concernée (non tranchée).
  midDot:      { re: /(?:^|\s)·|·(?=\s|$)/gmu, msg: 'point médian · séparateur (→ virgule/structure)' },
  bullet:      { re: /[•‣▪]/gu,          msg: 'puce unicode • (marqueur IA → tiret Markdown "-")' },
};
const ALL = Object.keys(RULES);
// Dans les commentaires de code : uniquement les marqueurs IA (em-dash, point
// médian, puce unicode). Espaces insécables/apostrophe/guillemets typographiques
// n'ont pas de sens hors texte typeset pour un lecteur (faux positifs jargon/anglais).
const COMMENT_RULES = ['emDash', 'midDot', 'bullet'];

// Règles DIFFÉRÉES : signalées mais NON bloquantes pour la CI. Vide depuis la
// passe de recomposition (juin 2026) → la CI est stricte sur les 6 règles.
// `--fix` recompose désormais em-dash et point médian séparateur en virgules.
const DEFERRED = new Set();

// Transformations auto-fixables (mono-caractère, longueur préservée). Chaque
// entrée localise le caractère à remplacer dans son match et la valeur cible.
//   spaceColon : / :(?!ident)/  → l'espace (index 0) devient U+00A0
//   spacePunct : / [;!?]/       → l'espace (index 0) devient U+202F
//   apostrophe : /lettre'lettre/ → l'apostrophe (index 1) devient ’
const FIXES = {
  spaceColon: { at: (m) => m.index, to: ' ' },
  spacePunct: { at: (m) => m.index, to: ' ' },
  apostrophe: { at: (m) => m.index + 1, to: '’' },
};

// --- Découpage en régions « contenu humain » par type de fichier ---------------
// Chaque région = { start, end, rules } sur le texte original (offsets absolus).

function mdRegions(t) {
  const code = new Array(t.length).fill(false);
  const mark = (re) => { for (const m of t.matchAll(re)) for (let i = m.index; i < m.index + m[0].length; i++) code[i] = true; };
  mark(/```[\s\S]*?```/g);          // blocs clôturés
  mark(/~~~[\s\S]*?~~~/g);
  mark(/`[^`\n]+`/g);               // code inline
  mark(/\]\([^)]*\)/g);             // cibles de liens ](url)
  mark(/<https?:\/\/[^>]+>/g);      // autoliens
  mark(/https?:\/\/\S+/g);          // URLs nues
  mark(/^\s*\[[^\]]+\]:\s.*$/gm);   // définitions de références
  const fm = t.match(/^---\n[\s\S]*?\n---\n/);  // front-matter YAML
  if (fm) for (let i = 0; i < fm[0].length; i++) code[i] = true;
  return runsFrom(code, ALL);
}

// Tokenizer commun balises/expressions → tableau de types par caractère.
// type : 'T' texte (rules ALL), 'C' commentaire (rules ALL ici car FR), 'X' code.
function bladeRegions(t) { return tagRegions(t, true); }
function htmlRegions(t) { return tagRegions(t, false); }

// Fin d'une balise ouverte en `i` (caractère '<') : scanne jusqu'au '>' NON
// situé dans une valeur d'attribut citée. Indispensable car les attributs
// Alpine/Blade contiennent des `=>`, `>` (arrow functions, comparaisons).
function tagEnd(t, i, blade) {
  let j = i + 1, q = null;
  while (j < t.length) {
    const c = t[j];
    if (q) { if (c === q) q = null; j++; continue; }
    // Sauter les expressions Blade {{ }} / {!! !!} et directives @name(...) :
    // elles contiennent des `=>`, `>`, guillemets qui fausseraient la fin de balise.
    if (blade && (t.startsWith('{{', j) || t.startsWith('{!!', j))) {
      const close = t.startsWith('{!!', j) ? '!!}' : '}}';
      const e = t.indexOf(close, j); j = e === -1 ? t.length : e + close.length; continue;
    }
    if (blade && c === '@' && /[a-zA-Z]/.test(t[j + 1] || '')) {
      let p = j + 1; while (p < t.length && /[a-zA-Z]/.test(t[p])) p++;
      let w = p; while (w < t.length && /\s/.test(t[w])) w++;
      j = t[w] === '(' ? parenEnd(t, w) : p; continue;       // @class([...]) etc.
    }
    if (c === '"' || c === "'") q = c;
    else if (c === '>') return j + 1;
    j++;
  }
  return t.length;
}

// Fin d'un groupe parenthésé ouvert en `k` ('('), parens imbriquées et
// littéraux cités gérés. Pour masquer les expressions des directives Blade.
function parenEnd(t, k) {
  let j = k, depth = 0, q = null;
  while (j < t.length) {
    const c = t[j], c2 = t[j + 1] || '';
    if (q) { if (c === '\\') { j += 2; continue; } if (c === q) q = null; j++; continue; }
    // commentaires PHP : leurs apostrophes/parenthèses ne comptent pas.
    if (c === '/' && c2 === '/') { const e = t.indexOf('\n', j); j = e === -1 ? t.length : e; continue; }
    if (c === '#') { const e = t.indexOf('\n', j); j = e === -1 ? t.length : e; continue; }
    if (c === '/' && c2 === '*') { const e = t.indexOf('*/', j + 2); j = e === -1 ? t.length : e + 2; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) return j + 1; }
    j++;
  }
  return t.length;
}

function tagRegions(t, blade) {
  const type = new Array(t.length).fill('T');
  const blank = (s, e, ty) => { for (let i = s; i < e && i < t.length; i++) type[i] = ty; };
  let i = 0;
  while (i < t.length) {
    if (blade && t.startsWith('{{--', i)) {
      const e = t.indexOf('--}}', i); const end = e === -1 ? t.length : e + 4;
      blank(i, end, 'C'); i = end; continue;                 // commentaire Blade : gardé
    }
    if (blade && (t.startsWith('{{', i) || t.startsWith('{!!', i))) {
      const close = t.startsWith('{!!', i) ? '!!}' : '}}';
      const e = t.indexOf(close, i); const end = e === -1 ? t.length : e + close.length;
      blank(i, end, 'X'); i = end; continue;                 // expression : code
    }
    if (blade && (t.startsWith('@php', i) || t.startsWith('@verbatim', i))) {
      const dir = t.startsWith('@php', i) ? '@endphp' : '@endverbatim';
      const e = t.indexOf(dir, i); const end = e === -1 ? t.length : e + dir.length;
      blank(i, end, 'X'); i = end; continue;                 // bloc PHP/verbatim : code
    }
    if (blade && t[i] === '@' && /[a-zA-Z]/.test(t[i + 1] || '')) {
      let j = i + 1; while (j < t.length && /[a-zA-Z]/.test(t[j])) j++;   // nom de directive
      let k = j; while (k < t.length && /\s/.test(t[k])) k++;
      if (t[k] === '(') { const end = parenEnd(t, k); blank(i, end, 'X'); i = end; continue; } // @if(...) etc.
      blank(i, j, 'X'); i = j; continue;                     // @endif/@else… (mot seul)
    }
    if (t.startsWith('<!--', i)) {
      const e = t.indexOf('-->', i); const end = e === -1 ? t.length : e + 3;
      blank(i, end, 'C'); i = end; continue;                 // commentaire HTML : gardé
    }
    // <style>/<script> : tout le bloc (CSS/JS) est du code, pas du contenu.
    const embed = /^<(style|script)[\s>]/i.exec(t.slice(i, i + 8));
    if (embed) {
      const close = `</${embed[1]}>`;
      const e = t.toLowerCase().indexOf(close.toLowerCase(), i);
      const end = e === -1 ? t.length : e + close.length;
      blank(i, end, 'X'); i = end; continue;
    }
    // Balise : <tag…>, mais aussi nom dynamique Blade <{{ $tag }}…>.
    if (t[i] === '<' && (/[a-zA-Z/!]/.test(t[i + 1] || '') || (blade && (t.startsWith('{{', i + 1) || t.startsWith('{!!', i + 1))))) {
      const end = tagEnd(t, i, blade);                       // fin de balise (attributs cités + Blade sautés)
      blank(i, end, 'X'); i = end; continue;                 // balise (attributs) : code
    }
    i++;
  }
  // 'T' texte rendu : toutes les règles. 'C' commentaire ({{-- --}}/<!-- -->) :
  // jamais typeset pour un lecteur → seulement les marqueurs IA (COMMENT_RULES),
  // comme pour les commentaires PHP.
  const regions = [];
  let s = 0;
  while (s < t.length) {
    if (type[s] === 'X') { s++; continue; }
    const ty = type[s];
    let e = s; while (e < t.length && type[e] === ty) e++;
    regions.push({ start: s, end: e, rules: ty === 'C' ? COMMENT_RULES : ALL });
    s = e;
  }
  return regions;
}

// Un fichier PHP de « contenu » (valeurs = texte humain) : lang/, traductions,
// seeders. Ailleurs (app/, config/, routes/…), les valeurs de chaînes sont du
// code → on ne traite QUE les commentaires (jamais les valeurs, pour ne pas
// corrompre une chaîne technique). Les commentaires FR sont traités partout.
function isContentPhp(file) {
  return /(^|\/)(lang|resources\/lang)\//.test(file) || /(^|\/)(database\/seeders|seeders)\//.test(file);
}

// PHP : commentaires (règles restreintes, partout) + valeurs de chaînes
// (toutes règles, fichiers de contenu uniquement).
function phpRegions(t, file) {
  const content = isContentPhp(file || '');
  const regions = [];
  let i = 0;
  const n = t.length;
  while (i < n) {
    const c = t[i], c2 = t[i + 1] || '';
    if (c === '/' && c2 === '/') { const e = t.indexOf('\n', i); const end = e === -1 ? n : e; regions.push({ start: i + 2, end, rules: COMMENT_RULES }); i = end; continue; }
    if (c === '#') { const e = t.indexOf('\n', i); const end = e === -1 ? n : e; regions.push({ start: i + 1, end, rules: COMMENT_RULES }); i = end; continue; }
    if (c === '/' && c2 === '*') { const e = t.indexOf('*/', i + 2); const end = e === -1 ? n : e; regions.push({ start: i + 2, end, rules: COMMENT_RULES }); i = end === n ? n : e + 2; continue; }
    if (c === "'" || c === '"') {
      const q = c; let j = i + 1;
      while (j < n) { if (t[j] === '\\') { j += 2; continue; } if (t[j] === q) break; j++; }
      // clé de tableau ? (suivie de =>) → on ignore ; sinon valeur (contenu only).
      let k = j + 1; while (k < n && /\s/.test(t[k])) k++;
      const isKey = t[k] === '=' && t[k + 1] === '>';
      if (!isKey && content) regions.push({ start: i + 1, end: j, rules: ALL });
      i = j + 1; continue;
    }
    i++;
  }
  return regions;
}

// Construit des régions à partir d'un masque booléen « code » (true = exclu).
function runsFrom(code, rules) {
  const regions = [];
  let s = 0;
  while (s < code.length) {
    if (code[s]) { s++; continue; }
    let e = s; while (e < code.length && !code[e]) e++;
    regions.push({ start: s, end: e, rules });
    s = e;
  }
  return regions;
}

// --- Moteur --------------------------------------------------------------------
function lineStarts(t) {
  const starts = [0];
  for (let i = 0; i < t.length; i++) if (t[i] === '\n') starts.push(i + 1);
  return starts;
}
function locate(starts, off) {
  let lo = 0, hi = starts.length - 1;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (starts[mid] <= off) lo = mid; else hi = mid - 1; }
  return { line: lo + 1, col: off - starts[lo] + 1 };
}

function regionsFor(file, t) {
  if (file.endsWith('.blade.php')) return bladeRegions(t);
  const ext = extname(file).toLowerCase();
  if (ext === '.md' || ext === '.markdown') return mdRegions(t);
  if (ext === '.html' || ext === '.htm') return htmlRegions(t);
  if (ext === '.php') return phpRegions(t, file);
  return null;
}

function checkFile(file) {
  let t;
  try { t = readFileSync(file, 'utf8'); } catch { return []; }
  const regions = regionsFor(file, t);
  if (!regions) return [];
  const starts = lineStarts(t);
  const ignored = new Set();
  for (let l = 0; l < starts.length; l++) {
    const end = l + 1 < starts.length ? starts[l + 1] : t.length;
    if (t.slice(starts[l], end).includes(IGNORE_TOKEN)) ignored.add(l + 1);
  }
  const out = [];
  for (const { start, end, rules } of regions) {
    const slice = t.slice(start, end);
    for (const name of rules) {
      const { re, msg } = RULES[name];
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(slice))) {
        const off = start + m.index + Math.max(0, m[0].search(/\S/));
        const { line, col } = locate(starts, off);
        if (!ignored.has(line)) out.push({ file, line, col, name, msg, snippet: t.slice(starts[line - 1], (line < starts.length ? starts[line] : t.length)).replace(/\n$/, '').trim().slice(0, 100) });
      }
    }
  }
  return out;
}

// Applique les 3 transformations sûres (mono-caractère) dans les régions de
// contenu, hors lignes `typo-ignore`. Retourne le nombre de corrections.
function fixFile(file) {
  let t;
  try { t = readFileSync(file, 'utf8'); } catch { return 0; }
  const regions = regionsFor(file, t);
  if (!regions) return 0;
  const starts = lineStarts(t);
  const ignored = new Set();
  for (let l = 0; l < starts.length; l++) {
    const end = l + 1 < starts.length ? starts[l + 1] : t.length;
    if (t.slice(starts[l], end).includes(IGNORE_TOKEN)) ignored.add(l + 1);
  }
  const chars = t.split('');   // unités UTF-16 (mêmes index que t.slice/m.index) ; [...t] (points de code) désynchroniserait sur un caractère hors BMP
  let count = 0;
  for (const { start, end, rules } of regions) {
    const slice = t.slice(start, end);
    for (const name of rules) {
      if (!FIXES[name]) continue;
      const { re } = RULES[name];
      const { at, to } = FIXES[name];
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(slice))) {
        const off = start + at(m);
        const { line } = locate(starts, off);
        if (!ignored.has(line) && chars[off] !== to) { chars[off] = to; count++; }
      }
    }
  }
  if (count) writeFileSync(file, chars.join(''));
  return count;
}

// Appariement des guillemets (passe à longueur variable, donc séparée du
// fix mono-caractère). « … » avec fine insécable intérieure (U+202F).
//   “ ”  directionnels → mappage direct, toujours sûr.
//   "     droits      → alternance ouvrant/fermant par région, UNIQUEMENT si
//                       le compte est pair (région équilibrée) ; sinon laissé
//                       au traitement manuel (région impaire = risque).
const OPEN = '« ', CLOSE = ' »';
function pairQuotesFile(file) {
  let t;
  try { t = readFileSync(file, 'utf8'); } catch { return 0; }
  const regions = regionsFor(file, t);
  if (!regions) return 0;
  // Régions où la règle « quotes » s'applique (jamais les commentaires de code).
  const qRegions = regions.filter((r) => r.rules.includes('quotes'));
  const starts = lineStarts(t);
  const ignoredLine = (off) => { const { line } = locate(starts, off); const s = starts[line - 1], e = line < starts.length ? starts[line] : t.length; return t.slice(s, e).includes(IGNORE_TOKEN); };
  const inRegion = (off) => qRegions.some((r) => off >= r.start && off < r.end);
  // compte des " droits par région (équilibre)
  const balanced = new Set();
  for (const r of qRegions) { const c = (t.slice(r.start, r.end).match(/"/g) || []).length; if (c > 0 && c % 2 === 0) balanced.add(r.start); }
  const regionOf = (off) => qRegions.find((r) => off >= r.start && off < r.end);
  let out = '', count = 0, openState = new Map();
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if ((ch === '“' || ch === '”' || ch === '"') && inRegion(i) && !ignoredLine(i)) {
      if (ch === '“') { out += OPEN; count++; continue; }
      if (ch === '”') { out += CLOSE; count++; continue; }
      const r = regionOf(i);
      if (balanced.has(r.start)) {
        const isOpen = !openState.get(r.start);
        openState.set(r.start, isOpen);
        out += isOpen ? OPEN : CLOSE; count++; continue;
      }
    }
    out += ch;
  }
  if (count) writeFileSync(file, out);
  return count;
}

// Recompose tirets cadratins, points médians séparateurs et puces unicode
// (marqueurs IA) en virgules ou tiret Markdown. Passe à longueur variable, par
// région de contenu, avec nettoyage de la double ponctuation produite.
// Heuristique : la virgule est grammaticalement sûre comme incise ; un cas
// isolé où deux-points ou parenthèses seraient préférables reste conforme.
function recomposeSlice(s) {
  // em-dash
  s = s.replace(/ +— +/g, ', ')
       .replace(/^([ \t]*)— +/gm, '$1- ')  // début de ligne = énumération → vraie puce
       .replace(/ +—$/gm, ',')
       .replace(/ +—/g, ',').replace(/— +/g, ', ')
       .replace(/—/g, ', ');
  // point médian séparateur (adjacent à une espace ; l'inclusif en mot est intact)
  s = s.replace(/ +· +/g, ', ')
       .replace(/^· +/gm, '').replace(/ +·$/gm, ',')
       .replace(/ +·/g, ',').replace(/· +/g, ', ');
  // puce unicode en début de ligne = énumération → vraie puce Markdown
  s = s.replace(/^([ \t]*)[•‣▪][ \t]+/gm, '$1- ')
       .replace(/[•‣▪]/g, ', ');
  // nettoyage de la double ponctuation issue de la recomposition
  s = s.replace(/,(?:\s*,)+/g, ',')
       .replace(/,\s*([.!?…])/g, '$1')   // virgule avant ponctuation finale (NE PAS toucher : ; — virgule légitime avant :placeholder)
       .replace(/([.!?…])[ \t]*,[ \t]*/g, '$1 ')
       .replace(/([(«])\s*,\s*/g, '$1')
       .replace(/,\s*([)»])/g, '$1');
  return s;
}
function recomposeFile(file) {
  let t;
  try { t = readFileSync(file, 'utf8'); } catch { return 0; }
  const regions = (regionsFor(file, t) || []).filter((r) => r.rules.includes('emDash'));
  if (!regions.length) return 0;
  let out = '', last = 0, count = 0;
  for (const { start, end } of regions.sort((a, b) => a.start - b.start)) {
    out += t.slice(last, start);
    const slice = t.slice(start, end);
    // ne pas recomposer une région contenant une ligne `typo-ignore`
    const done = slice.includes(IGNORE_TOKEN) ? slice : recomposeSlice(slice);
    if (done !== slice) count += (slice.match(/[—·•‣▪]/g) || []).length;
    out += done; last = end;
  }
  out += t.slice(last);
  if (count) writeFileSync(file, out);
  return count;
}

function walk(p, acc) {
  let st;
  try { st = statSync(p); } catch { return; }
  if (st.isDirectory()) {
    if (EXCLUDE_DIRS.has(basename(p))) return;
    for (const e of readdirSync(p)) walk(join(p, e), acc);
  } else if (st.isFile()) {
    if (p.endsWith('.blade.php') || /\.(md|markdown|html?|php)$/i.test(p)) acc.push(p);
  }
}

const FIX = process.argv.slice(2).includes('--fix');
const QUOTES = process.argv.slice(2).includes('--quotes');
const args = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const roots = args.length ? args : ['.'];
const files = [];
for (const r of roots) walk(r, files);

if (FIX) {
  let total = 0, touched = 0;
  for (const f of files) { const n = fixFile(f); if (n) { total += n; touched++; } }
  console.log(`✎ ${total} correction(s) mono-caractère (apostrophe, espaces) sur ${touched} fichier(s).`);
}
if (FIX || QUOTES) {
  let q = 0, qf = 0;
  for (const f of files) { const n = pairQuotesFile(f); if (n) { q += n; qf++; } }
  console.log(`✎ ${q} guillemet(s) apparié(s) « … » sur ${qf} fichier(s) (régions impaires laissées au manuel).`);
}
if (FIX) {
  let r = 0, rf = 0;
  for (const f of files) { const n = recomposeFile(f); if (n) { r += n; rf++; } }
  console.log(`✎ ${r} tiret(s)/point(s) médian(s) recomposé(s) en virgules sur ${rf} fichier(s).`);
}

const findings = [];
for (const f of files) findings.push(...checkFile(f));
findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.col - b.col);

const blocking = findings.filter((f) => !DEFERRED.has(f.name));
const deferred = findings.filter((f) => DEFERRED.has(f.name));

const tally = (list) => { const by = {}; for (const f of list) by[f.msg] = (by[f.msg] || 0) + 1; return Object.entries(by).sort((a, b) => b[1] - a[1]); };

for (const f of blocking) console.log(`${relative('.', f.file)}:${f.line}:${f.col}  ${f.msg}\n    ${f.snippet}`);

if (deferred.length) {
  console.log(`\n⚠ ${deferred.length} violation(s) DIFFÉRÉE(S) (non bloquantes, recomposition manuelle — issue de suivi) :`);
  for (const [msg, n] of tally(deferred)) console.log(`  ${String(n).padStart(5)}  ${msg}`);
}
if (blocking.length) {
  console.log(`\n✗ ${blocking.length} violation(s) bloquante(s) sur ${files.length} fichier(s) :`);
  for (const [msg, n] of tally(blocking)) console.log(`  ${String(n).padStart(5)}  ${msg}`);
  process.exit(1);
} else {
  console.log(`\n✓ Typographie française conforme sur les règles actives (${files.length} fichier(s)${deferred.length ? ', em-dash/point médian différés' : ''}).`);
}
