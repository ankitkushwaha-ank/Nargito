import { adminPage } from "@/server/admin";
import { AdminTitle } from "@/components/admin/admin-ui";
import { BrandSlot } from "@/components/admin/brand-slot";
import { SectionHeading } from "@/components/admin/admin-ui";
import { BRAND_KINDS, BRAND_SLOTS, brandFile, brandUrl } from "@/server/brand";

export const metadata = { title: "Logo & images" };

const LOGOS = ["logo", "wordmark", "wordmark-light", "favicon", "og"];

export default async function BrandingPage() {
  await adminPage("settings.general");
  const slots = await Promise.all(BRAND_KINDS.map(async (k) => ({ kind: k, ...BRAND_SLOTS[k], url: await brandUrl(k), custom: (await brandFile(k)).custom })));
  const logos = slots.filter((s) => LOGOS.includes(s.kind));
  const banners = slots.filter((s) => !LOGOS.includes(s.kind));
  const grid = "grid gap-4 sm:grid-cols-2 xl:grid-cols-3";
  return (
    <>
      <AdminTitle title="Logo & images" description="Change the logo, browser icon, link-share banner and the banner of every main page. Pick a file, press Upload, and it goes live straight away. Restore puts the original back." />
      <SectionHeading title="Logo and icons" hint="Header, browser tab and link previews." />
      <div className={grid}>{logos.map((s) => <BrandSlot key={s.kind} kind={s.kind} label={s.label} help={s.help} url={s.url} custom={s.custom} dark={s.kind === "wordmark-light"} />)}</div>
      <SectionHeading title="Page banners" hint="Home, login, explore, marketplace, trips, services, shops, groups and people." />
      <div className={grid}>{banners.map((s) => <BrandSlot key={s.kind} kind={s.kind} label={s.label} help={s.help} url={s.url} custom={s.custom} />)}</div>
    </>
  );
}
