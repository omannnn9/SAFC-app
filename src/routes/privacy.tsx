import { createFileRoute, Link } from "@tanstack/react-router";
import { SafcLogo } from "@/components/SafcLogo";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — SA FC" },
      {
        name: "description",
        content:
          "How SA FC (South Africa Football Community) collects, uses and protects your personal information.",
      },
    ],
  }),
  component: PrivacyPage,
});

const UPDATED = "10 June 2026";
const CONTACT = "di@thirdculture.world";

function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated={UPDATED}>
      <p>
        This Privacy Policy explains how SA FC (“SA FC”, “we”, “us”), the South
        Africa Football Community supporter platform at southafricafc.com,
        collects, uses, and protects your personal information when you use our
        website and services (the “Platform”).
      </p>

      <Section title="Who we are">
        <p>
          SA FC is a community platform for supporters of South African
          football. If you have any questions about this policy or your data,
          contact us at{" "}
          <a className="text-[var(--safc-yellow)] underline" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
          .
        </p>
      </Section>

      <Section title="Information we collect">
        <ul>
          <li>
            <strong>Account information</strong> you provide when you create an
            account — such as your name, email address, and optionally your
            country and phone number.
          </li>
          <li>
            <strong>Google Sign-In information.</strong> If you choose to sign in
            with Google, we receive basic profile information from your Google
            Account — your name, email address, and profile picture — as
            permitted by your Google account settings. We do not receive your
            Google password.
          </li>
          <li>
            <strong>Profile and community content</strong> you choose to add,
            such as a profile photo, posts, messages, and event participation.
          </li>
          <li>
            <strong>Technical data</strong> such as basic device and usage
            information needed to operate and secure the Platform.
          </li>
        </ul>
      </Section>

      <Section title="How we use your information">
        <ul>
          <li>To create and manage your account and supporter profile.</li>
          <li>To provide community features — events, messages, and membership.</li>
          <li>To communicate with you about your account and the Platform.</li>
          <li>To keep the Platform safe, secure, and working as intended.</li>
        </ul>
      </Section>

      <Section title="How your information is stored">
        <p>
          Your data is stored using Supabase (PostgreSQL) hosted on Google Cloud
          infrastructure. We apply reasonable technical and organisational
          measures, including encryption in transit, to protect your
          information.
        </p>
      </Section>

      <Section title="Sharing your information">
        <p>
          We do not sell your personal information. We only share data with
          service providers that help us operate the Platform (such as our
          hosting and authentication providers), and where required by law.
        </p>
      </Section>

      <Section title="Your choices and rights">
        <p>
          You can access and update your profile information at any time from
          your account settings. You may request access to, correction of, or
          deletion of your personal information by contacting us at{" "}
          <a className="text-[var(--safc-yellow)] underline" href={`mailto:${CONTACT}`}>
            {CONTACT}
          </a>
          . You can also revoke Google Sign-In access from your Google Account
          security settings.
        </p>
      </Section>

      <Section title="Children">
        <p>
          The Platform is not directed to children under 13, and we do not
          knowingly collect personal information from them.
        </p>
      </Section>

      <Section title="Changes to this policy">
        <p>
          We may update this Privacy Policy from time to time. When we do, we
          will revise the “Last updated” date above.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          Questions about this policy or your data? Email us at{" "}
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

export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-5 py-12 sm:py-16">
        <Link to="/" className="inline-flex items-center gap-2.5">
          <SafcLogo size={36} />
          <span className="font-display text-base font-extrabold tracking-tight text-foreground">
            SA FC
          </span>
        </Link>
        <h1 className="mt-8 font-display text-3xl font-black tracking-tight text-foreground sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Last updated: {updated}
        </p>
        <div className="mt-6 space-y-3 text-sm leading-relaxed text-muted-foreground">
          {children}
        </div>
        <div className="mt-12 border-t border-white/10 pt-6 text-sm">
          <Link to="/" className="text-[var(--safc-yellow)] underline">
            ← Back to SA FC
          </Link>
        </div>
      </div>
    </div>
  );
}
