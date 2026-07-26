# Contribuer au Wikilude

Merci de vouloir améliorer la base de connaissances de Geolude. Ce repo ne
contient que du contenu (Markdown + images), pas de code applicatif : toute
contribution passe par une Pull Request classique, relue avant merge.

## Workflow

1. Fork ce repo.
2. Crée une branche, modifie un article existant dans `content/`, ou ajoute
   un nouveau fichier `.md` (frontmatter + corps, voir schéma ci-dessous).
3. Avant d’ouvrir la PR, vérifie en local :
   ```bash
   node scripts/validate-frontmatter.mjs
   node scripts/check-fr-typography.mjs content
   ```
   Ces deux checks tournent aussi en CI sur la PR (`validate-content.yml`) ;
   les lancer en local évite un aller-retour.
4. Ouvre la Pull Request (le template précoche une checklist).

## Schéma d’un article

Chaque article est un fichier `.md` dans `content/`, avec un frontmatter
YAML :

```yaml
---
category: economie      # une des rubriques ci-dessous
title: Économie
excerpt: Résumé affiché sur l'index (1 phrase, ~160 caractères max).
position: 0              # ordre au sein de la rubrique
published: true          # false = brouillon, pas affiché
---

Le corps de l'article, en Markdown.
```

### Rubriques (`category`)

Liste fermée, alignée sur `App\Enums\WikiludeCategory` côté
[`Geolude/platform`](https://github.com/Geolude/platform), source de
vérité si tu veux en proposer une nouvelle (ouvre une issue plutôt que
d’inventer une valeur non reconnue, elle serait rejetée par la CI) :

| Valeur | Rubrique |
|---|---|
| `demarrer` | Démarrer |
| `cycles` | Cycles |
| `nation-societe` | Nation & société |
| `guerre-diplomatie` | Guerre & diplomatie |
| `progres-ressources` | Progrès & ressources |
| `gouvernance` | Gouvernance |
| `communaute` | Communauté |

`position` doit être unique au sein d’une même rubrique (vérifié en CI).

## Ton et style

Direct, à la 2ᵉ personne (« ton pays », « tu peux »), phrases courtes. Les
valeurs de mécaniques peuvent varier d’une partie à l’autre : préfère
décrire la mécanique plutôt que des chiffres figés quand c’est le cas, ou
précède les chiffres d’un avertissement (`> Réglable par partie`).

Typographie française vérifiée en CI (espaces insécables, apostrophes
typographiques, guillemets « », pas de tiret cadratin), `--fix` du script
corrige la plupart des cas automatiquement.

### Illustrer une formule

Quand un article affiche le calcul exact d’un score/valeur (ex.
`score-classement.md`), toujours la même forme, en fin d’article :

```markdown
## Formule

Une phrase de contexte sur ce que compare la formule.

\`\`\`
Score = ...
\`\`\`

> Ces valeurs sont réglables par partie ; celles ci-dessus sont celles
> par défaut.
```

Un bloc de code (` ``` `) est rendu par le DS (`ui`, `.ds-prose pre`)
comme un encadré distinct, pas comme du code brut. N'illustre que ce qui
s'affiche déjà au joueur (un écran cockpit, une valeur visible) — pas
toutes les mécaniques internes.

### Illustrer avec une capture d'écran

Les images vivent dans `content/assets/<slug-article>/`, référencées
depuis l'article en Markdown standard :

```markdown
![Description courte](assets/gouvernement/gouvernement--cabinet.png)
```

Convention de nommage : `<slug-article>--<contexte>.png` (ex.
`identite-nation--onglet-identite.png`). Une capture doit montrer un écran
ou une valeur réellement affichée au joueur, pas un mockup, recadrée pour
ne garder que la zone pertinente, sans données de partie sensibles
(nom de joueur, contenu RP d’un tiers) sauf accord.

## Licence

Le contenu de ce repo est publié sous [CC BY-SA 4.0](LICENSE) : toute
contribution est distribuée sous les mêmes termes.
