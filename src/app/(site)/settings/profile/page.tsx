import Link from "next/link";
import { Building2, Camera, Contact, FileText, User } from "lucide-react";
import { requireUserPage } from "@/server/auth/guard";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { ImageField } from "@/components/ui/image-field";
import { ResumeEditor } from "@/components/ui/resume-editor";
import { updateProfileAction } from "../actions";
import { profileCompletion } from "@/server/services/social";

export const metadata = { title: "Edit profile" };

function Section({ icon: Icon, title, hint, children }: { icon: typeof User; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card p-5 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-tint text-primary"><Icon size={20} aria-hidden /></span>
        <div><h2 className="text-lg font-bold leading-tight">{title}</h2>{hint && <p className="text-sm text-muted">{hint}</p>}</div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export default async function ProfileSettings() {
  const u = await requireUserPage("/settings/profile");
  const pct = profileCompletion(u);
  return (
    <ActionForm action={updateProfileAction} className="space-y-4">
      <div className="card flex flex-wrap items-center gap-4 p-5">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold">Edit your profile</h1>
          <p className="text-sm text-muted">A complete profile gets noticed more. You are {pct}% there.</p>
          <div className="mt-2 h-2 max-w-sm overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completion"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
        </div>
        <Link href={`/profile/${u.username}`} className="btn-secondary">View profile</Link>
      </div>

      <Section icon={Camera} title="Photos" hint="Your profile photo and the wide cover image.">
        <div className="grid gap-4 sm:grid-cols-2"><ImageField name="avatarUrl" label="Profile photo" shape="round" purpose="avatar" displayName={u.displayName} initial={u.avatarUrl} /><ImageField name="coverUrl" label="Cover image" shape="wide" initial={u.coverUrl} /></div>
      </Section>

      <Section icon={User} title="About you">
        <Field label="Display name" name="displayName" required defaultValue={u.displayName} maxLength={60} />
        <Field label="Headline" name="headline" defaultValue={u.headline} maxLength={120} help="One line, e.g. Student · Explorer · Creator" />
        <Field label="About" name="bio" as="textarea" rows={5} defaultValue={u.bio} maxLength={1000} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Location (city level)" name="locationLabel" defaultValue={u.locationLabel} maxLength={80} />
          <Field label="Website / portfolio" name="website" type="url" defaultValue={u.website} placeholder="https://" />
        </div>
        <Field label="Skills & interests" name="skills" defaultValue={u.skills.join(", ")} help="Comma separated, up to 15. Shown as coloured tags." />
      </Section>

      <Section icon={FileText} title="Resume" hint="Experience, education and certificates. Shown on your profile.">
        <ResumeEditor initial={u.resume ?? []} />
      </Section>

      <Section icon={Contact} title="Contact details">
        <div className="grid gap-4 sm:grid-cols-2"><Field label="Contact email" name="contactEmail" type="email" defaultValue={u.contactEmail} /><Field label="Contact phone" name="contactPhone" defaultValue={u.contactPhone} maxLength={30} /></div>
        <Field label="Who can see these?" name="contactVisibility" as="select" defaultValue={u.contactVisibility} options={[{ value: "private", label: "Only me" }, { value: "connections", label: "My connections" }, { value: "public", label: "Anyone who can view my profile" }]} />
      </Section>

      <Section icon={Building2} title="Run a shop or company?" hint="Businesses get their own page where they can post updates, list products and receive enquiries.">
        <div className="flex flex-wrap gap-2"><Link href="/my/businesses/shop/new" className="btn-secondary">Create a shop</Link><Link href="/my/businesses/company/new" className="btn-secondary">Create a company</Link><Link href="/my/businesses" className="btn-ghost">Manage mine</Link></div>
      </Section>

      <div className="sticky bottom-24 z-10 flex justify-end md:bottom-4"><SubmitButton className="shadow-lg">Save profile</SubmitButton></div>
    </ActionForm>
  );
}
