---
category: communaute
title: Score & classement
excerpt: Comment ton pays est classé face aux autres, et ce qui compte dans ton score.
position: 10
published: true
---

Les pays sont classés selon un **score**, qui agrège plusieurs aspects de
ta nation : population, niveau technologique, trésorerie, territoire,
guerres gagnées et perdues, bonheur, et taille de ta merveille. Être en
alliance apporte un léger bonus supplémentaire.

## Ce que tu vois

Ton score s’affiche sous une forme compacte (une valeur combinée à un
multiplicateur), avec le détail par critère consultable dans l’écran
Classement de ton pays.

## Classement

Le classement se recalcule à chaque cycle. À la fin d’une partie, un
palmarès conserve les meilleurs pays et alliances, ainsi que les
statistiques marquantes de la partie.

## Formule

Chaque critère est ramené sur 100 en le comparant à un repère fixe,
établi au lancement de la partie (pas au meilleur joueur du moment),
puis pondéré :

```
Score = 100 × ( 0,30 × (ta population / un repère de population)
              + 0,20 × (ta technologie / technologie max du jeu)
              + 0,15 × (ton trésor / un repère de trésor)
              + 0,15 × (ton territoire / un repère de territoire)
              + 0,10 × ((tes victoires − 0,5 × tes défaites) / un repère de guerres)
              + 0,05 × (ton bonheur / 100)
              + 0,05 × (hauteur de ta merveille / un repère de hauteur)
              )
        × (1 + 0,02 si idéologie affirmée + 0,01 si religion affirmée)
        × 1,10 si membre d'une alliance
```

Comme ce repère ne bouge pas avec les autres joueurs, ton score grandit
au fil de la partie plutôt que de plafonner dès que tout le monde
progresse au même rythme : c’est ce qui fait avancer le cristal au fil
des cycles, jusqu’aux paliers les plus rares en fin de partie.

Le score d’une alliance est la somme des scores de ses pays membres actifs
(les pays gelés pour inactivité prolongée ne comptent pas).

> Ces pondérations sont réglables par partie ; les valeurs ci-dessus sont
> celles par défaut.
