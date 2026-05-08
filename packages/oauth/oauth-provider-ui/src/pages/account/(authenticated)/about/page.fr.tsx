import { ReactNode } from 'react'
import { CustomizationName } from '#/components/customization-name.tsx'
import { AccountIdentifier } from '#/components/utils/account-identifier'
import { LinkExternal } from '#/components/utils/link-external'
import { useAuthenticatedSession } from '#/contexts/authentication'

export function Page(): ReactNode {
  const { account } = useAuthenticatedSession()

  return (
    <div className="prose-sm md:prose prose-slate dark:prose-invert max-w-none">
      <section>
        <h2>Qu'est-ce qu'un compte Atmosphère ?</h2>
        <p>
          Un <strong>compte Atmosphère</strong> est votre identité personnelle
          sur l'Atmosphère. Pensez-y comme à un passeport numérique que vous
          possédez vraiment, pas lié à une seule application ou entreprise.
        </p>
      </section>

      <section>
        <h3>Utilisez-le avec plusieurs applications</h3>
        <p>
          Votre compte Atmosphère fonctionne avec le réseau social{' '}
          <LinkExternal href="https://bsky.app">Bluesky</LinkExternal> ainsi que
          toutes les autres applications sociales construites sur le même
          réseau.
        </p>
        <p>
          De la même manière que vous pouvez utiliser la même adresse e-mail
          pour vous connecter à différents sites web, votre compte Atmosphère
          vous permet de vous connecter à différentes applications sociales tout
          en conservant la même identité, les mêmes connexions et le même
          contenu.
        </p>
        <p>
          Lorsque vous voyez des options pour vous connecter avec un "compte
          Atmosphère" ou un "pseudo Internet" sur d'autres applications, vous
          pouvez utiliser votre compte existant{' '}
          <strong className="whitespace-nowrap">
            <AccountIdentifier account={account} />
          </strong>{' '}
          plutôt que d'en créer un nouveau.
        </p>
      </section>

      <section>
        <h3>Qu'est-ce qui le rend spécial</h3>
        <p>
          La grande différence&nbsp;: vos données ne sont pas enfermées dans une
          seule application. Contrairement aux comptes de médias sociaux
          traditionnels, où vos données appartiennent à la plateforme, avec un
          compte Atmosphère, vous possédez véritablement votre identité et vos
          données&nbsp;:
        </p>
        <ul>
          <li>
            <strong>Vous possédez votre identité</strong>&nbsp;: Votre
            identifiant permanent vous appartient, et vous pouvez utiliser un
            nom de domaine que vous possédez comme pseudo si vous le souhaitez
          </li>
          <li>
            <strong>Vos données sont portables</strong>&nbsp;: Les publications,
            abonnements ("follows"), les "likes" et autres contenus vivent dans{' '}
            <em>votre</em> stockage de données personnel
          </li>
          <li>
            <strong>Vous pouvez vous déplacer librement</strong>&nbsp;: Changez
            de fournisseur d'hébergement sans perdre vos abonnés, publications
            ou connexions. Cela vous permet également de choisir un fournisseur
            dans votre pays si l'emplacement de vos données est important.
          </li>
          <li>
            <strong>Plusieurs applications, une identité</strong>&nbsp;:
            Utilisez le même compte sur différentes applications construites sur
            le même réseau
          </li>
        </ul>
      </section>

      <section>
        <h3>Ce site web&nbsp;: le centre de contrôle de votre compte</h3>
        <p>
          Le site web sur lequel vous êtes actuellement est votre{' '}
          <strong>centre de gestion de compte</strong>. Ici, vous pouvez&nbsp;:
        </p>
        <ul>
          <li>Mettre à jour votre adresse e-mail et votre mot de passe</li>
          <li>Gérer vos données personnelles et les paramètres de sécurité</li>
          <li>
            Afficher et gérer les sessions actives sur tous les appareils
            (navigateurs où vous êtes connecté)
          </li>
        </ul>
        <p>
          C'est ici que vous pouvez contrôler les aspects fondamentaux de votre
          identité Atmosphère, indépendamment des aspects spécifiques liés à une
          application, comme par exemple le profil que vous avez sur{' '}
          <LinkExternal
            href={`https://bsky.app/profile/${account.preferred_username ?? account.sub}`}
          >
            Bluesky
          </LinkExternal>
          .
        </p>
        <p>
          Votre compte Atmosphère est actuellement hébergé par{' '}
          <CustomizationName />, l'un des nombreux fournisseurs d'hébergement du
          réseau Atmosphère. Vous pouvez à tout moment changer de fournisseur
          sans perdre votre compte, votre identité ou vos données.
        </p>
      </section>

      <section>
        <h3>En savoir plus</h3>
        <p>
          Vous voulez en savoir plus sur la technologie et le réseau derrière
          votre compte Atmosphère ?
        </p>
        <ul>
          <li>
            <LinkExternal href="https://bsky.social">
              <strong>Bluesky Social</strong> — Informations générales sur le
              réseau
            </LinkExternal>
          </li>
          <li>
            <LinkExternal href="https://atproto.com">
              <strong>AT Protocol</strong> — Documentation technique pour les
              développeurs
            </LinkExternal>
          </li>
        </ul>
      </section>
    </div>
  )
}
