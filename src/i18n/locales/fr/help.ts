import type { Translation } from '@/i18n/core';
import type { help as en } from '../en/help';

export const help: Translation<typeof en> = {
  'help.intro.title': 'Ce que fait Pinto',
  'help.intro.body':
    'Google Play permet de fixer un prix et de le convertir, ou de modifier les pays un par un. Pinto couvre tout l’entre-deux : il modifie les prix d’un produit dans de nombreux pays à la fois, affiche chaque nouveau prix avant de rien appliquer et peut restaurer les prix précédents.',

  'help.before.title': 'Avant de commencer',
  'help.before.permission':
    'Votre compte Google doit avoir le droit de gérer les prix de cette application dans la Play Console.',
  'help.before.api':
    'L’API Google Play Developer doit être activée dans votre projet Google Cloud, et ce projet associé à votre compte Play Console sous <b>Configuration → Accès à l’API</b>.',
  'help.before.page':
    'Ouvrez un abonnement ou un produit ponctuel dans la Play Console, puis ouvrez Pinto : il reprend le produit affiché sur la page.',

  'help.steps.title': 'Les trois étapes',
  'help.steps.intro':
    'Chaque modification de prix passe par les trois mêmes étapes, affichées en haut du panneau. Le bouton du bas indique toujours la suite.',
  'help.steps.strategy':
    'Choisissez comment les prix changent. L’étape s’ouvre à {zero} : rien ne change tant que vous n’avez pas choisi. Cliquez ensuite sur <b>{next}</b>.',
  'help.steps.markets':
    'Tous les pays où le produit est vendu sont sélectionnés au départ. La recherche et les filtres changent seulement les pays affichés, jamais ceux qui seront modifiés. Cliquez ensuite sur <b>{next}</b>.',
  'help.steps.review':
    'Vérifiez chaque nouveau prix, pays par pays. Les avertissements sont expliqués et les pays bloqués ne sont jamais modifiés. Lancez d’abord une simulation si vous le souhaitez, puis appliquez.',

  'help.strategies.title': 'Choisir une modification',
  'help.strategy.percentage':
    'Augmente ou baisse tous les prix du même pourcentage : le choix habituel pour une hausse ou une baisse générale. Les écarts relatifs entre pays sont conservés.',
  'help.strategy.fixed':
    'Un prix dans le pays de référence, converti dans la devise de chaque pays avec les taux de Google. La même valeur partout.',
  'help.strategy.tiers':
    'Facture moins là où les revenus sont plus faibles : les pays sont regroupés par pouvoir d’achat et chaque palier paie une part d’un prix d’ancrage. Détails plus bas.',
  'help.strategy.copy':
    'Reprend le prix actuel d’un pays et l’utilise partout, converti dans chaque devise.',
  'help.strategy.multiplier':
    'Un pourcentage exprimé sous forme de coefficient : × {factor} augmente chaque prix de {share}.',
  'help.strategy.formula':
    'Écrivez le calcul vous-même, par exemple <code>min(current * 1.15, 19.99)</code>. <code>current</code> est le prix actuel du pays ; <code>base</code> est le prix du pays de référence, converti dans la devise du pays.',

  'help.tiers.body':
    'Pinto regroupe les pays en {count} paliers selon les revenus et les dépenses en applications. Le prix d’ancrage est celui du palier le plus élevé ; chaque autre palier en paie une part. Choisissez une courbe pour fixer ces parts, puis ajustez un palier ou déplacez un pays dans un autre.',
  'help.tiers.bands': 'Les paliers',
  'help.tiers.curves': 'Les courbes',
  'help.tiers.floor': 'Le palier le plus bas paie {share} du prix d’ancrage.',
  'help.tiers.basis': 'D’où viennent les paliers',

  'help.safety.title': 'Sécurité',
  'help.safety.review':
    'Rien n’est appliqué avant l’étape <b>{review}</b>, et seulement aux pays sélectionnés dont le prix change.',
  'help.safety.simulate':
    'Une simulation effectue les mêmes contrôles et s’enregistre dans <b>{history}</b> sans rien envoyer à Google. Lancez-en une la première fois.',
  'help.safety.typed': 'À partir de {count} pays, vous devez saisir le nombre de pays pour confirmer.',
  'help.safety.restore':
    'Chaque opération conserve les prix précédents. Dans <b>{history}</b>, le bouton <b>{restore}</b> affiche le prix actuel et le prix précédent de chaque pays, écarte les pays modifiés depuis sauf si vous les incluez, et restaure les autres.',
  'help.safety.verify':
    'Une fois les prix appliqués, Pinto les relit auprès de Google. Un pays dont le prix relu ne correspond pas est signalé, et l’opération est marquée « {partial} », ou « {unverified} » si la relecture elle-même a échoué.',
  'help.safety.subscribers':
    'Pour les abonnements, un nouveau prix s’applique aux nouveaux abonnés. Les abonnés existants gardent le leur jusqu’à ce que vous les migriez vers le nouveau prix dans la Play Console, qui impose ses propres règles de préavis.',

  'help.messages.title': 'Messages fréquents',
  'help.messages.intro':
    'Ce que signifient certains messages, et que faire. Le même conseil s’affiche avec le message lui-même.',
  'help.messages.quote': '« {text} »',

  'help.panel.title': 'Fenêtre du panneau et clavier',
  'help.panel.body':
    'La barre au-dessus du panneau a quatre boutons : <b>{left}</b>, <b>{right}</b>, <b>{float}</b> et <b>{collapse}</b> pour replier Pinto sur sa barre et accéder à la page en dessous. Faites glisser la barre pour déplacer une fenêtre flottante. Pour redimensionner, faites glisser le bord intérieur d’un panneau ancré ou le coin d’une fenêtre flottante.',
};
