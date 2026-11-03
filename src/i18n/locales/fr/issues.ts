import type { Translation } from '@/i18n/core';
import type { issues as en } from '../en/issues';

export const issues: Translation<typeof en> = {
  'issue.no-current-price': 'Aucun prix actuel dans ce pays : rien à ajuster.',
  'issue.no-source-price': 'Le pays à copier n’a pas de prix.',
  'issue.no-base-price': 'Le pays de référence n’a pas de prix et aucun prix d’ancrage n’est défini.',
  'issue.no-rates': 'Aucun taux de change disponible pour convertir ce prix.',
  'issue.no-rate': 'Aucun taux de change pour {currency} : le produit n’a pas encore de prix en {currency}.',
  'issue.tier-undefined': 'Le palier « {tier} » n’a pas de pourcentage.',
  'issue.formula-error': 'La formule a échoué : {reason}',
  'issue.not-positive': 'Le prix doit être supérieur à zéro.',
  'issue.granularity-whole': 'Pas de centimes en {currency} : le prix doit être un nombre entier.',
  'issue.granularity-minor': {
    one: 'Les prix en {currency} ont {decimals} décimale.',
    other: 'Les prix en {currency} ont {decimals} décimales.',
  },
  'issue.unknown-currency':
    'Nombre de décimales inconnu pour {currency} : Pinto en a supposé deux. Vérifiez ce prix.',
  'issue.large-increase': 'Hausse de plus de {threshold}.',
  'issue.large-decrease': 'Baisse de plus de {threshold}.',
  'issue.rounded': 'Ajusté par la règle d’arrondi.',
  'issue.below-floor': 'Relevé à votre prix minimum.',
  'issue.above-ceiling': 'Abaissé à votre prix maximum.',
  'issue.override': 'Prix exact défini pour ce pays.',
  'issue.untiered': 'Dans aucun palier : son prix reste inchangé.',
  'issue.not-sold': 'Ce produit n’est pas vendu ici. Ajoutez d’abord le pays dans la Play Console.',
  'issue.clamped-increase': 'Limité à votre hausse maximale de {limit}.',
  'issue.clamped-decrease': 'Limité à votre baisse maximale de {limit}.',

  'formula.empty': 'la formule est vide',
  'formula.not-a-number': '« {text} » n’est pas un nombre',
  'formula.unexpected-character': 'caractère inattendu « {char} »',
  'formula.expected': '« {token} » manquant',
  'formula.trailing-input': 'caractères en trop à la fin',
  'formula.unknown-function': 'fonction inconnue « {name} »',
  'formula.arity': '« {name} » accepte de {min} à {max} valeurs',
  'formula.unknown-name': 'nom inconnu « {name} » : utilisez current ou base',
  'formula.unexpected-end': 'la formule s’arrête trop tôt',
  'formula.division-by-zero': 'division par zéro',
  'formula.unsupported-operator': 'opérateur « {op} » non pris en charge',
  'formula.not-finite': 'le résultat n’est pas un nombre',
  'formula.invalid': 'la formule n’est pas valide',
};
