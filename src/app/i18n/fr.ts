import type { TranslationKey } from './en';

/**
 * French. Typed against the English key set, so a missing key is a build error
 * rather than an English string surfacing mid-sentence.
 */
export const fr: Record<TranslationKey, string> = {
  // --- Navigation et coquille -----------------------------------------------
  'nav.pricing': 'Prix',
  'nav.strategy': 'Stratégie',
  'nav.presets': 'Presets',
  'nav.history': 'Historique',
  'nav.settings': 'Réglages',
  'nav.guide': 'Guide',
  'app.tagline': 'Tarifer en masse, sans la masse de travail.',
  'app.account': 'Compte',
  'app.signOut': 'Déconnexion',

  // --- Actions communes -----------------------------------------------------
  'action.cancel': 'Annuler',
  'action.clear': 'Vider',
  'action.retry': 'Réessayer',
  'action.dismiss': 'Ignorer',
  'action.reviewChanges': 'Vérifier les changements',
  'action.backToCountries': 'Retour aux pays',
  'action.selectAllVisible': 'Tout sélectionner',
  'action.done': 'Terminé',
  'action.save': 'Enregistrer',

  // --- Écran des prix -------------------------------------------------------
  'pricing.searchPlaceholder': 'Rechercher un pays, un code, une devise',
  'pricing.allCurrencies': 'Toutes les devises',
  'pricing.resetFilters': 'Réinitialiser les filtres',
  'pricing.shownSelected': '{shown} affichés · {selected} sélectionnés',
  'pricing.countriesSelected': '{count} pays sélectionnés',
  'pricing.countrySelected': '1 pays sélectionné',
  'pricing.willChange': '{count} vont changer',
  'pricing.needAttention': '{count} à vérifier',
  'pricing.noMatch': 'Aucun pays ne correspond',
  'pricing.noMatchBody': 'Essaie une autre recherche, ou réinitialise les filtres.',

  // --- Réglages -------------------------------------------------------------
  'settings.language': 'Langue',
  'settings.languageHint': 'Ne concerne que le panneau Pinto. Google Play garde sa propre langue.',
  'settings.account': 'Compte',
  'settings.thisApp': 'Cette application',
  'settings.storage': 'Ce que Pinto conserve',
  'settings.log': 'Journal des opérations',
  'settings.keyboard': 'Clavier',

  // --- Guide ----------------------------------------------------------------
  'guide.title': 'Comment fonctionne Pinto',
  'guide.intro':
    'Google Play sait appliquer un seul prix à tous les pays, ou t’obliger à les modifier un par un. Pinto couvre tout ce qu’il y a entre les deux — et n’écrit jamais rien avant que tu l’aies vu.',
  'guide.beforeTitle': 'Avant de commencer',
  'guide.before1': 'Il te faut un compte Play Console autorisé à modifier les prix, et l’API Play Developer activée sur le projet Google Cloud qui lui est lié.',
  'guide.before2': 'Pinto lit et écrit via cette API avec ton propre compte Google. Les prix vont directement de ce panneau à Google — il n’y a pas de serveur Pinto.',
  'guide.before3': 'Ouvre un abonnement, un produit ponctuel ou une page de prix dans Play Console. Pinto détecte le produit automatiquement.',

  'guide.flowTitle': 'Les quatre étapes',
  'guide.step1Title': '1 · Choisir le produit',
  'guide.step1Body':
    'Le sélecteur en haut liste chaque forfait de base d’abonnement et chaque produit ponctuel de l’application. Si tu as ouvert un produit dans Play Console, il est déjà sélectionné.',
  'guide.step2Title': '2 · Choisir les pays',
  'guide.step2Body':
    'Tout est sélectionné par défaut. Affine avec la recherche, les puces de continent, les puces de sous-région en dessous, ou le filtre de devise. Clique une ligne pour basculer un pays. Enregistre une sélection récurrente en groupe.',
  'guide.step3Title': '3 · Choisir une stratégie',
  'guide.step3Body':
    'La stratégie décide du nouveau prix de chaque pays sélectionné. Les prix se mettent à jour en direct dans le tableau — rien n’est encore envoyé.',
  'guide.step4Title': '4 · Vérifier, puis appliquer',
  'guide.step4Body':
    'La vérification répartit le résultat entre Changing, Warnings, Blocked et Unchanged. Lis Blocked en premier : ces pays sont exclus de l’écriture, avec la raison. Puis applique.',

  'guide.strategiesTitle': 'Quelle stratégie choisir',
  'guide.stratPercentage': 'Percentage — décale chaque prix sélectionné du même pourcentage. Pour une hausse générale.',
  'guide.stratMultiplier': 'Multiplier — la même chose exprimée en facteur. 1,2 augmente d’un cinquième.',
  'guide.stratFixed': 'Fixed price — un prix cible unique, converti dans la devise de chaque marché. Même valeur partout.',
  'guide.stratCopy': 'Copy from — reprend le prix actuel d’un marché et le propage, converti.',
  'guide.stratTiers': 'Tiers — faire payer moins là où l’on gagne moins. C’est ce que Play Console ne sait pas faire.',
  'guide.stratFormula': 'Formula — écris toi-même le calcul, ex. min(current * 1.15, 19.99).',

  'guide.zoneTitle': 'Tarifer par zone économique',
  'guide.zoneBody':
    'Ouvre Stratégie → Tiers. Pinto démarre sur une échelle de cinq bandes de pouvoir d’achat, construite sur les marchés où ton produit est réellement vendu.',
  'guide.zone1': 'Fixe l’ancre — le prix de référence dont toute l’échelle est une fraction.',
  'guide.zone2': 'Choisis la pente : Flat, Gentle, Balanced ou Aggressive. Le prix obtenu par bande est affiché avant de générer.',
  'guide.zone3': 'Modifie tout. Change le pourcentage d’une bande, clique son compteur de marchés pour voir ses pays, et retire ceux qui n’ont rien à y faire.',
  'guide.zoneCaveat':
    'Les bandes viennent des groupes de revenu de la Banque mondiale et du RNB par habitant en PPA, corrigés par les dépenses observées sur les stores. C’est un point de départ à discuter, pas une mesure — vérifie-le avant d’appliquer.',

  'guide.safetyTitle': 'Sécurité',
  'guide.safety1': 'Le dry run enregistre l’opération dans l’Historique sans rien envoyer à Google. À utiliser la première fois.',
  'guide.safety2': 'Au-delà de 25 pays modifiés, Pinto demande de saisir le nombre pour confirmer.',
  'guide.safety3': 'Chaque opération appliquée conserve les prix tels qu’ils étaient. Historique → Restaurer les remet.',
  'guide.safety4': 'Pour un abonnement, un nouveau prix s’applique aux nouveaux abonnés. Les abonnés actuels gardent le leur jusqu’à un changement de prix lancé depuis Play Console, qui a ses propres règles de préavis.',

  'guide.troubleTitle': 'Messages fréquents',
  'guide.troubleNotAvailable':
    '« X is not an available country for this base plan » — le produit n’y est pas vendu. Ajoute d’abord le pays dans Play Console ; Pinto ne peut pas créer de marché.',
  'guide.troubleRegionsVersion':
    '« Priced in EUR but Pinto asked for BGN » — un pays a changé de monnaie récemment. Recharge les prix et réessaie : Pinto récupère la version de régions courante auprès de Google.',
  'guide.troubleNoRate':
    '« Cannot convert » — ce marché n’a pas encore de prix, donc aucun taux ne permet la conversion. Donne-lui un prix dans Play Console, ou utilise une stratégie sans conversion.',
  'guide.troubleBlocked':
    'Les lignes Blocked ne sont jamais écrites. Tout le reste du lot s’applique quand même.',

  'guide.shortcutsTitle': 'Clavier',
  'guide.scOpen': 'Ouvrir ou fermer Pinto',
  'guide.scSearch': 'Aller à la recherche de pays',
  'guide.scSelectAll': 'Sélectionner ou vider les pays affichés',
  'guide.scReview': 'Vérifier les changements',
  'guide.scClose': 'Fermer le panneau',
  'guide.panelTitle': 'Déplacer le panneau',
  'guide.panelBody':
    'Glisse la barre de titre pour le déplacer, ou ancre-le à gauche ou à droite avec les flèches. Le bouton ▾ le réduit à sa barre de titre pour atteindre Play Console en dessous. Tire un bord pour redimensionner.',
};
