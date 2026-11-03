import type { Translation } from '@/i18n/core';
import type { markets as en } from '../en/markets';

//  : espace fine insécable (avant ? ! ;) ·  : espace insécable (avant :, dans « »).
export const markets: Translation<typeof en> = {
  'markets.title': 'Dans quels pays ?',
  'markets.subtitle': 'Les prix changent uniquement dans les pays sélectionnés.',

  'markets.search.label': 'Rechercher un pays',
  'markets.search.placeholder': 'Pays, code ou devise',

  'markets.filters.toggle': 'Filtres',
  'markets.filters.active': { one: '{count} actif', other: '{count} actifs' },
  'markets.filters.continents': 'Continent',
  'markets.filters.subregions': 'Région',
  'markets.filters.currency': 'Devise',
  'markets.filters.allCurrencies': 'Toutes les devises',
  'markets.filters.reset': 'Effacer les filtres',

  'markets.selection.allShown': 'Sélectionner les pays affichés',
  'markets.selection.selected': { one: '{count} sélectionné', other: '{count} sélectionnés' },
  'markets.selection.shown': { one: '{count} affiché', other: '{count} affichés' },
  'markets.selection.all': 'Tout sélectionner',
  'markets.selection.none': 'Tout désélectionner',
  'markets.selection.hidden': {
    one: '{count} pays sélectionné est masqué par vos filtres : son prix changera aussi.',
    other: '{count} pays sélectionnés sont masqués par vos filtres : leurs prix changeront aussi.',
  },
  'markets.selection.keepShown': 'Garder les pays affichés',
  'markets.selection.showHidden': 'Les afficher',

  'markets.groups.label': 'Vos groupes',
  'markets.groups.hint':
    'Un clic sur un groupe sélectionne uniquement ses pays ; <kbd>Maj</kbd>+clic les ajoute à la sélection.',
  'markets.groups.save': 'Enregistrer comme groupe',
  'markets.groups.saveBody': {
    one: 'Nommez cette sélection pour retrouver ce pays en un clic, dans n’importe quel produit.',
    other: 'Nommez cette sélection pour retrouver ces {count} pays en un clic, dans n’importe quel produit.',
  },
  'markets.groups.name': 'Nom du groupe',
  'markets.groups.namePlaceholder': 'p. ex. Pays nordiques',
  'markets.groups.delete': 'Supprimer le groupe « {name} »',
  'markets.groups.deleteTitle': 'Supprimer le groupe « {name} » ?',
  'markets.groups.deleteBody':
    'Le groupe est supprimé pour tous les produits. Votre sélection actuelle ne change pas.',
  'markets.groups.saved': {
    one: 'Groupe « {name} » enregistré ({count} pays)',
    other: 'Groupe « {name} » enregistré ({count} pays)',
  },

  'markets.table.label': 'Pays',
  'markets.table.country': 'Pays',
  'markets.table.price': 'Prix',
  'markets.row.change': 'de {from} à {to}',
  'markets.row.noChange': 'Inchangé',
  'markets.row.blocked': 'Bloqué',


  'markets.empty.title': 'Aucun pays ne correspond',
  'markets.empty.body': 'Essayez une autre recherche ou effacez les filtres.',
};
