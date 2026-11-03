import type { Translation } from '@/i18n/core';
import type { onboarding as en } from '../en/onboarding';

export const onboarding: Translation<typeof en> = {
  'onboarding.setup.title': 'Connecter Pinto à Google Play',
  'onboarding.setup.lead':
    'Pinto se connecte via un client OAuth de votre propre projet Google Cloud : c’est vous qui accordez l’accès, et vous pouvez le révoquer à tout moment. Cinq étapes à faire une seule fois, en cinq minutes environ.',
  'onboarding.setup.stepsLabel': 'Étapes de configuration',

  'onboarding.setup.api.title': 'Activer l’API Google Play Android Developer',
  'onboarding.setup.api.body':
    'Dans Google Cloud, choisissez ou créez un projet, puis activez l’API pour ce projet.',
  'onboarding.setup.api.link': 'Ouvrir la page de l’API',

  'onboarding.setup.consent.title': 'Configurer l’écran de consentement OAuth',
  'onboarding.setup.consent.body':
    'Choisissez <b>Externe</b>. Vous pouvez rester en mode test : ajoutez votre propre compte Google comme utilisateur test.',
  'onboarding.setup.consent.link': 'Ouvrir l’écran de consentement',

  'onboarding.setup.client.title': 'Créer un client OAuth',
  'onboarding.setup.client.body':
    'Choisissez le type <b>Application Web</b> et ajoutez cette adresse sous <b>URI de redirection autorisés</b> :',
  'onboarding.setup.client.link': 'Créer le client',

  'onboarding.setup.link.title': 'Associer le projet à la Play Console',
  'onboarding.setup.link.body':
    'Dans la Play Console, ouvrez <b>Configuration → Accès à l’API</b> et associez le même projet Cloud. Sans cela, Google Play refuse les requêtes de Pinto, même après votre connexion.',

  'onboarding.setup.paste.title': 'Coller l’ID client',
  'onboarding.setup.paste.body':
    'Google l’affiche à la création du client. Vous le retrouvez aussi dans les détails du client.',

  'onboarding.redirect.label': 'URI de redirection',
  'onboarding.redirect.copy': 'Copier l’URI de redirection',

  'onboarding.clientId.label': 'ID client OAuth',
  'onboarding.clientId.placeholder': '1234567890-abc.apps.googleusercontent.com',
  'onboarding.clientId.invalid':
    'Ce n’est pas un ID client. Il se termine par .apps.googleusercontent.com : vérifiez que vous avez copié l’ID client, et non le code secret.',
  'onboarding.clientId.save': 'Enregistrer l’ID client',
  'onboarding.clientId.saved': 'ID client enregistré. Vous pouvez vous connecter.',
  'onboarding.clientId.change': 'Changer l’ID client OAuth',

  'onboarding.signIn.lead':
    'Modifiez les prix d’un produit dans tous les pays à la fois, et vérifiez chaque prix avant qu’il ne soit appliqué.',
  'onboarding.signIn.action': 'Se connecter avec Google',
  'onboarding.privacy':
    'Il n’y a pas de serveur Pinto : Pinto échange directement avec Google depuis votre navigateur. Il demande l’autorisation <code>androidpublisher</code> pour lire et modifier les prix, ainsi que votre adresse e-mail et votre nom pour afficher le compte connecté. Le jeton d’accès reste en mémoire, pour cette session du navigateur uniquement.',

  'onboarding.language.label': 'Langue',
  'onboarding.language.auto': 'Automatique',

  'onboarding.package.title': 'De quelle application s’agit-il ?',
  'onboarding.package.why':
    'La Play Console désigne cette application par <code>#{id}</code> dans son adresse, mais l’API Google Play Developer a besoin de son nom de package. Pinto le demande une fois et s’en souvient pour cette application.',
  'onboarding.package.whereTitle': 'Où le trouver',
  'onboarding.package.whereDashboard':
    'Sur le tableau de bord de l’application dans la Play Console, sous son nom.',
  'onboarding.package.whereStore': 'Dans l’adresse de l’application sur le Play Store, après <code>id=</code>.',
  'onboarding.package.label': 'Nom de package',
  'onboarding.package.placeholder': 'com.example.app',
  'onboarding.package.invalid':
    'Ce n’est pas un nom de package. Un nom de package ressemble à com.example.app : des mots en minuscules séparés par des points.',
  'onboarding.package.submit': 'Continuer',

  'onboarding.unsupported.title': 'Ouvrez les prix d’un produit',
  'onboarding.unsupported.body':
    'Pinto s’ouvre à côté des prix qu’il modifie : ceux d’un abonnement, d’un produit ponctuel, ou la page de prix de l’application dans la Play Console.',
  'onboarding.unsupported.howTitle': 'Pour y accéder',
  'onboarding.unsupported.how1': 'Dans la Play Console, ouvrez votre application.',
  'onboarding.unsupported.how2': 'Allez dans <b>Monétiser avec Play → Produits</b>.',
  'onboarding.unsupported.how3': 'Ouvrez un abonnement ou un produit ponctuel.',
  'onboarding.unsupported.check': 'Vérifier à nouveau',
  'onboarding.unsupported.still': 'Cet onglet n’affiche toujours pas les prix d’un produit.',
};
