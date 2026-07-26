# Wikilude

Le contenu éditorial du **Wikilude**, la base de connaissances publique de
[Geolude](https://github.com/Geolude) : règles du jeu, mécaniques,
conseils. Ce repo ne contient **que du contenu joueur** (Markdown), pas de
code applicatif, le moteur et la plateforme vivent dans
[`Geolude/platform`](https://github.com/Geolude/platform) et
[`Geolude/game`](https://github.com/Geolude/game).

## Contribuer

Les Pull Requests sont bienvenues, qu’il s’agisse de corriger une
imprécision ou d’ajouter un article. Voir [`CONTRIBUTING.md`](CONTRIBUTING.md)
pour le schéma d’un article, les rubriques valides, le ton attendu et les
checks à lancer en local avant d’ouvrir une PR.

Une erreur repérée ou un sujet manquant ? [Ouvre une issue](https://github.com/Geolude/wikilude/issues/new/choose).

## Infos utiles

- **Structure** : un article = un fichier `.md` dans `content/`, avec
  frontmatter YAML (`category`, `title`, `excerpt`, `position`,
  `published`), détail dans `CONTRIBUTING.md`.
- **Illustrations** : `content/assets/<slug-article>/`, référencées en
  Markdown standard depuis l’article.
- **Où ce contenu est utilisé** : synchronisé vers la base de données de
  [`Geolude/platform`](https://github.com/Geolude/platform) (table
  `wikilude_articles`), qui l’expose publiquement sur `/wikilude` et via
  l’API `GET /api/wikilude` consommée par les instances de jeu
  ([`Geolude/game`](https://github.com/Geolude/game), écran cockpit
  « Wikilude »).
- **Licence** : [CC BY-SA 4.0](LICENSE).
