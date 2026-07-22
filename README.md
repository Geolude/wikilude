# Wikilude

Le contenu éditorial du **Wikilude**, la base de connaissances publique de
[Geolude](https://github.com/Geolude) : règles du jeu, mécaniques,
conseils. Ce repo ne contient **que du contenu joueur** (Markdown), pas de
code applicatif — le moteur et la plateforme vivent dans
[`Geolude/platform`](https://github.com/Geolude/platform) et
[`Geolude/game`](https://github.com/Geolude/game).

## Structure

Chaque article est un fichier `.md` dans `content/`, avec un frontmatter
YAML :

```yaml
---
category: economie      # une des rubriques (demarrer, cycles, economie, bonheur, guerre, lois, communaute)
title: Économie
excerpt: Résumé affiché sur l'index (1 phrase).
position: 0             # ordre au sein de la rubrique
published: true         # false = brouillon, pas affiché
---

Le corps de l'article, en Markdown.
```

## Contribuer

1. Fork ce repo.
2. Modifie un article existant dans `content/`, ou ajoute-en un nouveau
   (frontmatter + corps).
3. Ouvre une Pull Request. Elle sera relue avant merge.

Le ton : direct, à la 2ᵉ personne (« ton pays », « tu peux »), phrases
courtes. Les valeurs de mécaniques peuvent varier d'une partie à l'autre :
préfère décrire la mécanique plutôt que des chiffres figés quand c'est le
cas, ou précède les chiffres d'un avertissement (`> Réglable par partie`).

### Illustrer une formule

Quand un article affiche le calcul exact d'un score/valeur (ex.
`score-classement.md`), toujours la même forme, en fin d'article :

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

## Où ce contenu est utilisé

Le contenu de ce repo est synchronisé vers la base de données de
[`Geolude/platform`](https://github.com/Geolude/platform) (table
`wikilude_articles`), qui l'expose publiquement sur `/wikilude` et via
l'API `GET /api/wikilude` consommée par les instances de jeu
([`Geolude/game`](https://github.com/Geolude/game), écran cockpit
« Wikilude »).
