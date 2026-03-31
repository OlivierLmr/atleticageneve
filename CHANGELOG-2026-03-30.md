# Résumé des modifications — Refactoring retours client (mars 2026)

## 1. Modèle de données — Contrat unique par athlète
- **Avant** : un contrat par candidature (par épreuve). **Maintenant** : un seul contrat par athlète, couvrant toutes ses épreuves.
- Deux niveaux de statut :
  - **Statut de négociation** (par athlète) : à examiner → contrat envoyé → contre-offre → accepté/refusé/retiré
  - **Statut de participation** (par épreuve) : en attente → sélectionné / non sélectionné

## 2. Éditeur de contrat enrichi
- Champ "Autre compensation" avec description libre
- Transport local : 2 cases séparées (aéroport↔hôtel, hôtel↔stade) avec coûts configurables
- Grille nuitées × dîners (mardi à dimanche)
- Repas au stade (case à cocher)
- Sélection d'hôtel (dropdown)
- Calcul du coût total en temps réel côté serveur

## 3. Coûts configurables par édition
- Prix nuitée d'hôtel, dîner, repas stade, transports locaux : tous paramétrables dans l'édition (plus de constantes hardcodées)

## 4. Inscription athlète simplifiée
- Email obligatoire
- Genre en boutons radio
- Sélection multi-épreuves (cases à cocher filtrées par genre)
- Compliance (I Run Clean, Doping Free) en cases à cocher
- Suppression des champs PB/SB/ranking (désormais saisis séparément)

## 5. Inscription manager améliorée
- Colonnes ajoutées : genre, date de naissance, URL profil World Athletics
- Multi-sélection d'épreuves par athlète (filtrées par genre)
- Suppression des colonnes email athlète, fédération, PB, SB

## 6. Portails athlète et manager
- Vue groupée par athlète (un contrat, N épreuves)
- Coûts internes masqués pour l'athlète
- Contre-offre avec tous les nouveaux champs
- Nouveau lien détail athlète depuis le portail manager

## 7. Dashboard comité
- KPIs basés sur le statut de négociation (dédupliqués par athlète)
- Taux de remplissage basés sur le statut de participation par épreuve
- Suivi quotas suisses et EAP

## 8. Table WA Performance
- Saisie manuelle PB/SB/ranking par athlète et par épreuve
- Le scoring et l'affichage lisent depuis cette table
- Prêt pour un import automatisé futur

## 9. Tests
- 209 tests automatisés (unitaires + intégration), tous passants
