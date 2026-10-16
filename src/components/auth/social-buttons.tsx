import { providerStatus } from "@/server/auth/oauth";
import { getT } from "@/i18n/server";

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" /><path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" /><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" /><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.4-5.7c-2.1 1.4-4.9 2.3-8.5 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" /></svg>
  );
}
function FacebookMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden><path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7.1V12h3V9.4c0-3 1.8-4.7 4.5-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12h3.4l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z" /></svg>
  );
}

/** Real OAuth entry points. Providers that are not set up/enabled are simply not shown to visitors. */
export async function SocialButtons({ next }: { next?: string }) {
  const t = await getT();
  const [g, f] = await Promise.all([providerStatus("google"), providerStatus("facebook")]);
  const q = next ? `?next=${encodeURIComponent(next)}` : "";
  const items = [
    { id: "google", label: t("auth.google"), st: g, icon: <GoogleMark /> },
    { id: "facebook", label: t("auth.facebook"), st: f, icon: <FacebookMark /> },
  ].filter((i) => i.st.available);
  if (!items.length) return null;
  return (
    <>
      <div className="my-6 flex items-center gap-3 text-xs text-muted"><span className="h-px flex-1 bg-line" />{t("auth.or")}<span className="h-px flex-1 bg-line" /></div>
      <div className="space-y-2">
        {items.map((i) => (
          // Plain anchor: the start route performs a server redirect to the provider.
          <a key={i.id} href={`/api/auth/oauth/${i.id}${q}`} className="btn-secondary w-full">{i.icon}{i.label}</a>
        ))}
      </div>
    </>
  );
}