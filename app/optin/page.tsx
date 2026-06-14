import { PolarisMark } from "@/components/PolarisMark";

export const metadata = { title: "Polaris — Text for Housing Help" };

export default function OptIn() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center px-5 py-16 text-center">
      <PolarisMark size={48} />
      <h1 className="mt-6 text-3xl font-bold text-ink">Need a place to stay tonight?</h1>
      <p className="mt-3 text-lg text-muted">Free, confidential help finding a verified shelter — from any phone.</p>

      <div className="panel panel-glow mt-8 w-full p-6">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-aurora">Text to start</div>
        <div className="mt-3 text-3xl font-bold text-ink">
          Text <span className="text-north">HOUSING</span>
        </div>
        <div className="mt-1 text-xl font-semibold text-ink">to (408) 889-7563</div>
        <p className="mt-4 text-sm text-muted">
          Polaris replies with shelter availability near you — confirmed by phone before we send you anywhere.
        </p>
      </div>

      <p className="mt-6 max-w-md text-xs leading-relaxed text-faint">
        By texting HOUSING you agree to receive SMS from Polaris about your request. Up to ~10 messages per request;
        message frequency varies with your conversation. Msg &amp; data rates may apply. Reply <strong className="text-muted">HELP</strong> for
        help, <strong className="text-muted">STOP</strong> to opt out. We never share your number.{" "}
        <a href="/terms" className="text-aurora hover:underline">Terms</a> ·{" "}
        <a href="/privacy" className="text-aurora hover:underline">Privacy</a>.
      </p>

      <p className="mono mt-6 text-[11px] text-faint">Not an emergency service. In danger, call 911. Crisis support: call/text 988.</p>
    </div>
  );
}
