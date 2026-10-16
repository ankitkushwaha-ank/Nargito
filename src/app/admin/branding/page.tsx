import { adminPage } from "@/server/admin";
import { AdminTitle } from "@/components/admin/admin-ui";
import { BrandSlot } from "@/components/admin/brand-slot";
import { BRAND_KINDS, BRAND_SLOTS, brandFile, brandUrl } from "@/server/brand";

export const metadata = { title: "Logo & images" };

export default async function BrandingPage() {
  await adminPage("settings.general");
  const slots = await Promise.all(BRAND_KINDS.map(async (k) => ({ kind: k, ...BRAND_SLOTS[k], url: await brandUrl(k), custom: (await brandFile(k)).custom })));
  return (
    <>
      <AdminTitle title="Logo & images" description="Change the logo, browser icon, link-share banner and home page pictures. Pick a file, press Upload, and it goes live straight away. You can always restore the original." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {slots.map((s) => <BrandSlot key={s.kind} kind={s.kind} label={s.label} help={s.help} url={s.url} custom={s.custom} dark={s.kind === "wordmark-light"} />)}
      </div>
    </>
  );
}
