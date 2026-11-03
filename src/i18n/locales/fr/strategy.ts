import type { Translation } from '@/i18n/core';
import type { strategy as en } from '../en/strategy';

export const strategy: Translation<typeof en> = {
  'strategy.title': 'Comment les prix doivent-ils changer ?',
  'strategy.subtitle': 'Choisissez une modification pour {product}. Les pays viennent ensuite.',
  'strategy.kind.label': 'Type de modification',
  'strategy.next.hint': 'Choisissez d’abord comment les prix changent.',
  'strategy.next.invalid': 'Corrigez la valeur signalée pour continuer.',
  'strategy.amount.invalid': 'Saisissez un prix supérieur à zéro.',

  'strategy.start.title': 'Point de départ',
  'strategy.recent.text': 'Votre dernière modification : {summary} · {when}',
  'strategy.recent.use': 'Réutiliser',
  'strategy.recent.compounds':
    'Les prix actuels incluent déjà cette modification : la réutiliser l’appliquerait une deuxième fois.',

  'strategy.presets.saved': 'Modèle « {name} » enregistré',
  'strategy.presets.applied': 'Modèle « {name} » chargé : vérifiez-le, puis continuez',
  'strategy.presets.imported': { one: '{count} modèle importé', other: '{count} modèles importés' },
  'strategy.presets.label': 'Modèle enregistré',
  'strategy.presets.choose': 'Choisir un modèle…',
  'strategy.presets.use': 'Utiliser',
  'strategy.presets.manage': 'Modèles enregistrés',
  'strategy.presets.count': { one: '{count} modèle', other: '{count} modèles' },
  'strategy.presets.empty':
    'Aucun modèle pour l’instant. Enregistrez une modification pour la réutiliser sur d’autres produits et applications, ou importez un fichier.',
  'strategy.presets.regions': {
    one: '{summary} · {count} pays',
    other: '{summary} · {count} pays',
  },
  'strategy.presets.anyRegions': '{summary} · pays choisis à l’utilisation',
  'strategy.presets.delete': 'Supprimer le modèle « {name} »',
  'strategy.presets.deleteTitle': 'Supprimer « {name} » ?',
  'strategy.presets.deleteBody':
    'Le modèle est supprimé de ce navigateur. Les prix déjà appliqués ne changent pas.',
  'strategy.presets.export': 'Exporter en JSON',
  'strategy.presets.import': 'Importer un JSON',
  'strategy.presets.save': 'Enregistrer comme modèle',
  'strategy.presets.saveNeutral': 'Choisissez comment les prix changent avant d’enregistrer un modèle.',
  'strategy.presets.saveTitle': 'Enregistrer comme modèle',
  'strategy.presets.name': 'Nom',
  'strategy.presets.namePlaceholder': 'Remise de lancement',
  'strategy.presets.nameRequired': 'Donnez un nom au modèle.',
  'strategy.presets.description': 'Description (facultative)',
  'strategy.presets.withSelection': {
    one: 'Inclure le pays sélectionné',
    other: 'Inclure les {count} pays sélectionnés',
  },
  'strategy.presets.withoutSelection':
    'Le modèle s’appliquera aux pays sélectionnés au moment où vous l’utiliserez.',

  'strategy.base.option': '{country} · {price}',
  'strategy.base.showAll': 'Tous les pays ({count})',
  'strategy.base.showKey': 'Pays principaux seulement',

  'strategy.percentage.label': 'Variation',
  'strategy.percentage.hint':
    'Appliquée au prix actuel de chaque pays. Un nombre négatif baisse les prix.',
  'strategy.percentage.invalid': 'Saisissez un pourcentage entre {min} et {max}.',
  'strategy.percentage.quick': 'Variations courantes',

  'strategy.multiplier.label': 'Coefficient',
  'strategy.multiplier.hint': 'Par exemple, {factor} signifie {delta} sur chaque prix.',
  'strategy.multiplier.invalid': 'Saisissez un coefficient entre {min} et {max}.',

  'strategy.fixed.amount': 'Prix',
  'strategy.fixed.base': 'Pays de référence',

  'strategy.copy.from': 'Pays à copier',
  'strategy.copy.current': 'Prix actuel : {price}.',

  'strategy.convert.title': 'Conversion des devises',
  'strategy.convert.on': 'Activée',
  'strategy.convert.off': 'Désactivée',
  'strategy.convert.label': 'Convertir dans la devise de chaque pays',
  'strategy.convert.description':
    'Utilise les taux de change de Google pour ce produit, ou ceux qu’impliquent ses prix actuels.',
  'strategy.convert.offTitle': 'Le même nombre dans toutes les devises',
  'strategy.convert.offBody':
    'La conversion est désactivée : le nombre est écrit tel quel partout, 4,99 dollars comme 4,99 yens. C’est rarement ce que vous voulez.',
  'strategy.convert.turnOn': 'Activer la conversion',

  'strategy.formula.label': 'Formule',
  'strategy.formula.hint': 'Calculée pour chaque pays, dans sa propre devise.',
  'strategy.formula.examples': 'Exemples de formules',
  'strategy.formula.help':
    '<code>current</code> est le prix actuel du pays. <code>base</code> est le prix du pays de référence, converti dans la devise du pays. Fonctions : <code>min</code>, <code>max</code>, <code>round</code>, <code>floor</code>, <code>ceil</code>, <code>abs</code>.',
  'strategy.formula.base': 'Pays de référence (base)',

  'strategy.ladder.title': 'Prix selon le pouvoir d’achat',
  'strategy.ladder.intro':
    'Créez une grille de cinq paliers de pouvoir d’achat, vérifiez les prix, puis ajustez n’importe quel palier ou pays.',
  'strategy.ladder.base': 'Pays de référence',
  'strategy.ladder.anchor': 'Prix d’ancrage',
  'strategy.ladder.anchorHint': 'Le prix dans le pays de référence. Chaque palier en paie une part.',
  'strategy.ladder.useCurrent': 'Utiliser le prix actuel ({price})',
  'strategy.ladder.curve': 'Écart de prix entre les paliers',
  'strategy.ladder.previewCaption': 'Prix de chaque palier',
  'strategy.ladder.col.band': 'Palier',
  'strategy.ladder.col.countries': 'Pays',
  'strategy.ladder.col.share': 'Part',
  'strategy.ladder.col.price': 'Prix',
  'strategy.ladder.note':
    'La génération sélectionne aussi les pays de la grille. Tout reste modifiable, et rien n’est appliqué avant votre vérification.',
  'strategy.ladder.replaces':
    'La génération remplace les paliers actuels et sélectionne les pays de la nouvelle grille. Rien n’est appliqué avant votre vérification.',
  'strategy.ladder.generate': 'Générer la grille',
  'strategy.ladder.regenerate': 'Générer une nouvelle grille',
  'strategy.ladder.regenerateSummary': 'Remplace les paliers ci-dessous',
  'strategy.ladder.regenerateAction': 'Remplacer la grille',
  'strategy.ladder.selectionSet': {
    one: 'Sélection : {count} pays de la grille',
    other: 'Sélection : les {count} pays de la grille',
  },

  'strategy.tiers.title': { one: '{count} palier', other: '{count} paliers' },
  'strategy.tiers.anchor': 'Prix d’ancrage ({country})',
  'strategy.tiers.anchorHint': 'Chaque palier est une part de ce prix.',
  'strategy.tiers.share': 'Part du prix d’ancrage pour {tier}',
  'strategy.tiers.shareInvalid': 'Saisissez une part entre 0 et {max}.',
  'strategy.tiers.remove': 'Supprimer le palier {tier}',
  'strategy.tiers.members': 'Pays du palier {tier}',
  'strategy.tiers.removeCountry': 'Retirer du palier {tier} : {country}',
  'strategy.tiers.addRegion': 'Ajouter une région…',
  'strategy.tiers.addRegionLabel': 'Ajouter une région au palier {tier}',
  'strategy.tiers.groups.mine': 'Mes groupes',
  'strategy.tiers.groups.continents': 'Continents',
  'strategy.tiers.groups.subregions': 'Sous-régions',
  'strategy.tiers.groupOption': '{name} ({count})',
  'strategy.tiers.addSelected': 'Ajouter la sélection ({count})',
  'strategy.tiers.newLabel': 'Nom du nouveau palier',
  'strategy.tiers.newPlaceholder': 'p. ex. Europe',
  'strategy.tiers.exists': 'Un palier porte déjà ce nom.',
  'strategy.tiers.add': 'Ajouter un palier',
  'strategy.tiers.untiered': {
    one: '{count} pays vendu n’est dans aucun palier : son prix restera inchangé.',
    other: '{count} pays vendus ne sont dans aucun palier : leurs prix resteront inchangés.',
  },
  'strategy.tiers.notSelected': {
    one: '{count} pays de la grille n’est pas sélectionné : son prix ne changera pas.',
    other: '{count} pays de la grille ne sont pas sélectionnés : leurs prix ne changeront pas.',
  },
  'strategy.tiers.selectThem': 'Les sélectionner',

  'strategy.advanced.title': 'Options avancées',
  'strategy.advanced.summaryLimits': '{rounding} · limites : {limits}',

  'strategy.rounding.label': 'Arrondi',
  'strategy.rounding.charm': 'Prix psychologiques',
  'strategy.rounding.about.charm':
    'Termine les prix par 99, 95, 90 ou 49 centimes, au plus proche. Jamais par 00 ni 50.',
  'strategy.rounding.endings': 'Mes terminaisons',
  'strategy.rounding.about.endings': 'Uniquement les terminaisons que vous indiquez ci-dessous.',
  'strategy.rounding.endingsHint': 'Décimales entre 0 et 1, séparées par « ; », par exemple 0,99 ; 0,49.',
  'strategy.rounding.integer': 'Unités entières',
  'strategy.rounding.about.integer': 'Arrondit à l’unité entière de chaque devise.',
  'strategy.rounding.none': 'Exact',
  'strategy.rounding.about.none': 'Garde le prix calculé, à la plus petite unité de la devise.',
  'strategy.rounding.endingsLabel': 'Terminaisons',
  'strategy.rounding.endingsInvalid': 'Utilisez des nombres entre 0 et 1, comme 0,99.',
  'strategy.rounding.endingsApplied': 'Terminaisons utilisées',
  'strategy.rounding.step': 'Pas pour les devises sans décimales',
  'strategy.rounding.stepHint':
    'Le JPY, le KRW et les autres devises sans centimes s’arrondissent à ce pas, adapté au montant.',
  'strategy.rounding.stepInvalid': 'Saisissez un nombre entier supérieur ou égal à 1.',
  'strategy.rounding.note':
    'L’arrondi ne déplace jamais un prix de plus d’une unité, ou d’un pas pour les devises sans décimales.',

  'strategy.limits.label': 'Limites',
  'strategy.limits.maxIncrease': 'Hausse maximale',
  'strategy.limits.maxDecrease': 'Baisse maximale',
  'strategy.limits.none': 'Aucune',
  'strategy.limits.hint':
    'Dans chaque pays, par rapport à son prix actuel. Laissez vide pour ne pas limiter.',
  'strategy.limits.invalid': 'Saisissez un pourcentage positif ou nul.',
  'strategy.limits.invalidDecrease': 'Saisissez un pourcentage entre 0 et 99.',

  'strategy.legacy.title': 'Ce modèle utilise d’anciennes limites de prix',
  'strategy.legacy.body':
    'Son prix plancher et son prix plafond comparent un même nombre dans toutes les devises : ils ne valent pas du tout la même chose en yens et en euros. Retirez-les et utilisez plutôt les limites en pourcentage.',
  'strategy.overrides.body': {
    one: 'Ce modèle fixe un prix exact pour {count} pays, qui l’emporte sur la modification ci-dessus.',
    other: 'Ce modèle fixe des prix exacts pour {count} pays, qui l’emportent sur la modification ci-dessus.',
  },

  'strategy.preview.title': 'Aperçu',
  'strategy.preview.reference': 'Référence',
  'strategy.preview.becomes': 'devient',
  'strategy.preview.blocked': 'Bloqué',
  'strategy.preview.unchanged': 'Inchangé',
  'strategy.preview.notSelected': 'Non sélectionné',
  'strategy.preview.count': {
    one: '{count} prix change au total. Vous choisirez les pays ensuite.',
    other: '{count} prix changent au total. Vous choisirez les pays ensuite.',
  },
  'strategy.preview.nothing': 'Avec ces réglages, aucun prix ne change.',
};
