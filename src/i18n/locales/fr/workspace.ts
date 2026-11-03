import type { Translation } from '@/i18n/core';
import type { workspace as en } from '../en/workspace';

export const workspace: Translation<typeof en> = {
  'workspace.header.history': 'Historique',
  'workspace.header.help': 'Aide',
  'workspace.header.settings': 'Réglages',
  'workspace.header.packageLabel': 'Application',
  'workspace.loading': 'Chargement de Pinto…',

  'workspace.product.label': 'Produit',
  'workspace.product.choose': 'Choisir un produit…',
  'workspace.product.priced': {
    one: 'Prix défini dans {count} pays',
    other: 'Prix défini dans {count} pays',
  },
  'workspace.product.unavailableTitle': '{group} : liste indisponible',
  'workspace.product.unavailableNote':
    'Les produits de ce type n’apparaissent pas dans la liste, ce qui ne veut pas dire qu’il n’y en a aucun.',
  'workspace.product.noOneTime':
    'Cette application n’a aucun produit ponctuel. Un achat à vie est un produit ponctuel : créez-le dans la Play Console sous Monétiser avec Play → Produits, puis rechargez.',

  'workspace.loadingProducts': 'Chargement des produits…',
  'workspace.loadingPrices': 'Chargement des prix…',
  'workspace.noProducts.title': 'Aucun produit à tarifer',
  'workspace.noProducts.body':
    'Cette application n’a ni abonnement ni produit ponctuel. Créez-en un dans la Play Console, puis rechargez.',
  'workspace.listFailed.title': 'Impossible de charger les produits',
  'workspace.chooseProduct.title': 'Choisissez un produit à tarifer',
  'workspace.chooseProduct.body':
    'Sélectionnez un forfait de base d’abonnement ou un produit ponctuel ci-dessus. Ouvrir un produit dans la Play Console le sélectionne ici automatiquement.',

  'workspace.package.detectedTitle': 'Application détectée : {package}',
  'workspace.package.detectedBody':
    'Pinto a lu ce nom de package sur la page. Vérifiez qu’il s’agit de la bonne application avant de modifier un prix.',
  'workspace.package.confirm': 'C’est la bonne',
  'workspace.package.change': 'Modifier',

  'workspace.steps.label': 'Étapes de la modification des prix',
  'workspace.step.strategy': 'Modification',
  'workspace.step.markets': 'Pays',
  'workspace.step.review': 'Vérification',
  'workspace.step.position': 'Étape {current} sur {total}',
  'workspace.step.strategy.empty': 'À choisir',
  'workspace.step.markets.summary': '{selected} sur {total}',
  'workspace.step.review.summary': { one: '{count} prix modifié', other: '{count} prix modifiés' },
  'workspace.step.review.empty': 'Pas encore',

  'workspace.summary.none': 'Aucun prix ne change',
  'workspace.summary.changes': {
    one: '{count} prix va changer',
    other: '{count} prix vont changer',
  },
  'workspace.summary.blocked': { one: '{count} bloqué', other: '{count} bloqués' },
  'workspace.summary.warnings': { one: '{count} à vérifier', other: '{count} à vérifier' },
  'workspace.summary.selected': {
    one: '{count} pays sélectionné',
    other: '{count} pays sélectionnés',
  },
  'workspace.next.markets': 'Choisir les pays',
  'workspace.next.review': 'Vérifier les prix',
};
