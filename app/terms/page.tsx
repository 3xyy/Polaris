export const metadata = { title: "Polaris — Terms & Conditions" };

export default function Terms() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-14">
      <h1 className="text-2xl font-bold text-ink">Terms &amp; Conditions</h1>
      <p className="mono mt-1 text-xs text-faint">Last updated: June 2026</p>

      <div className="mt-6 space-y-5 text-sm leading-relaxed text-muted">
        <Section title="The service">
          Polaris is a free, informational SMS/voice service that helps people find housing
          resources and verified shelter availability. By texting our number you consent to
          receive SMS replies from Polaris related to your request.
        </Section>

        <Section title="Messaging terms">
          Polaris only replies to messages you send us; frequency varies with your interaction.{" "}
          <strong className="text-ink">Message and data rates may apply.</strong> Text{" "}
          <strong className="text-ink">STOP</strong> to opt out at any time and{" "}
          <strong className="text-ink">HELP</strong> for assistance. Carriers are not liable for
          delayed or undelivered messages.
        </Section>

        <Section title="Not an emergency service">
          Polaris does not provide emergency, medical, legal, or crisis services. If you are in
          immediate danger, call 911. For crisis support, call or text 988. Resource and
          availability information is provided in good faith but is not guaranteed.
        </Section>

        <Section title="No warranty">
          The service is provided “as is” without warranties of any kind. Polaris is a
          demonstration project and is not liable for any decisions made based on the
          information provided.
        </Section>

        <Section title="Privacy">
          Your use is also governed by our{" "}
          <a href="/privacy" className="text-aurora underline-offset-2 hover:underline">Privacy Policy</a>.
        </Section>

        <Section title="Contact">
          <span className="text-ink">yuvrajdar9@gmail.com</span>
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
