export const metadata = { title: "Polaris — Privacy Policy" };

export default function Privacy() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-14">
      <h1 className="text-2xl font-bold text-ink">Privacy Policy</h1>
      <p className="mono mt-1 text-xs text-faint">Last updated: June 2026</p>

      <div className="mt-6 space-y-5 text-sm leading-relaxed text-muted">
        <p>
          Polaris is a free service that helps people experiencing housing insecurity find
          verified shelter availability and resources over SMS and voice.
        </p>

        <Section title="What we collect">
          When you text or call Polaris, we process your phone number and the contents of your
          messages so we can understand your situation and reply with relevant, verified housing
          resources. We do not require your legal name, Social Security number, or any
          government ID to use the service.
        </Section>

        <Section title="How we use it">
          Your information is used only to provide the housing-navigation service — extracting
          your needs, matching eligible resources, verifying availability, and replying to you.
        </Section>

        <Section title="No sharing of mobile information">
          <strong className="text-ink">
            We do not sell, rent, or share your mobile phone number or SMS consent with any third
            parties or affiliates for marketing or promotional purposes.
          </strong>{" "}
          Information may be shared only with a housing or service provider you explicitly ask us
          to contact on your behalf.
        </Section>

        <Section title="Message frequency & rates">
          Polaris is conversational and only messages you in reply to your own messages, so
          message frequency varies based on your interaction. <strong className="text-ink">Message and data rates may apply.</strong>{" "}
          Reply <strong className="text-ink">STOP</strong> at any time to opt out, or{" "}
          <strong className="text-ink">HELP</strong> for help.
        </Section>

        <Section title="Crisis support">
          Polaris is not an emergency service. If you are in danger, call 911. For mental-health
          crisis support, call or text 988 anytime.
        </Section>

        <Section title="Contact">
          Questions about this policy: <span className="text-ink">contact@polaris.example</span>.
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <p className="mt-1.5">{children}</p>
    </div>
  );
}
