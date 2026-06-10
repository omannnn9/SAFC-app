import { createFileRoute } from "@tanstack/react-router";
import { LegalShell } from "@/routes/privacy";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — SA FC" },
      {
        name: "description",
        content:
          "The terms that govern your use of the SA FC (South Africa Football Community) platform.",
      },
    ],
  }),
  component: TermsPage,
});

const UPDATED = "10 June 2026";
const CONTACT = "di@thirdculture.world";

function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated={UPDATED}>
      <p>
        Welcome to SA FC, the South Africa Football Community platform at
        southafricafc.com (the “Platform”). By creating an account or using the
        Platform, you agree to these Terms of Service (“Terms”).
      </p>

      <Section title="Eligibility and accounts">
        <p>
          You must be at least 13 years old to use the Platform. You are
          responsible for the activity on your account and for keeping your login
          credentials secure. You may sign in using an email address and
          password, or with Google Sign-In.
        </p>
      </Section>

      <Section title="Acceptable use">
        <p>You agree not to use the Platform to:</p>
        <ul>
          <li>Post unlawful, hateful, harassing, or abusive content.</li>
          <li>Impersonate others or misrepresent your affiliation.</li>
          <li>Disrupt, attack, or attempt to gain unauthorised access to the Platform.</li>
          <li>Infringe the rights of others, including intellectual property rights.</li>
        </ul>
      </Section>

      <Section title="Your content">
        <p>
          You retain ownership of the content you post. By posting, you grant SA
          FC a non-exclusive licence to host and display that content for the
          purpose of operating the Platform. You are responsible for the content
          you share.
        </p>
      </Section>

      <Section title="Membership">
        <p>
          Some features may be offered as paid memberships. Details of any fees
          and benefits will be presented to you before purchase.
        </p>
      </Section>

      <Section title="Termination">
        <p>
          You may stop using the Platform and delete your account at any time. We
          may suspend or terminate access if these Terms are violated.
        </p>
      </Section>

      <Section title="Disclaimers">
        <p>
          The Platform is provided “as is” without warranties of any kind. To the
          fullest extent permitted by law, SA FC is not liable for any indirect
          or consequential damages arising from your use of the Platform.
        </p>
      </Section>

      <Section title="Governing law">
        <p>
          These Terms are governed by the laws of the Republic of South Africa.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about these Terms? Email us at{" "}
          <a className="text-[var(--safc-yellow)] underline" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
          .
        </p>
      </Section>
    </LegalShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-black tracking-tight text-foreground">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted-foreground [&_ul]:mt-2 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
