import { redirect } from "next/navigation";
import { requireUserPage } from "@/server/auth/guard";
import { Container } from "@/components/shell/frames";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { ImageField } from "@/components/ui/image-field";
import { completeOnboardingAction } from "./actions";
import { Notice } from "@/components/ui/kit";

export const metadata = { title: "Welcome" };

export default async function Onboarding({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const user = await requireUserPage("/onboarding");
  if (user.onboardingDone) redirect("/home");
  return (
    <Container width="max-w-xl">
      <h1 className="text-2xl">Welcome to Nargito, {user.displayName.split(" ")[0]}</h1>
      <p className="mt-1 text-sm text-muted">A few details help people recognise you. You can change everything later.{sp.type === "business" ? " Next you will set up your shop page." : ""}</p>
      {!user.emailVerifiedAt && <div className="mt-4"><Notice tone="warn">Your email is not verified yet. You can look around, but posting and messaging unlock after verification.</Notice></div>}
      <ActionForm action={completeOnboardingAction} className="card mt-6 space-y-4 p-5">
        <ImageField name="avatarUrl" label="Profile photo" shape="round" purpose="avatar" displayName={user.displayName} initial={user.avatarUrl} />
        <Field label="Headline" name="headline" defaultValue={user.headline} maxLength={120} placeholder="e.g. Photographer | Trip organiser" />
        <Field label="Where are you based? (city level)" name="locationLabel" defaultValue={user.locationLabel} maxLength={80} placeholder="e.g. Pune, India" help="Shown on your profile. Never your exact address." />
        <Field label="About you" name="bio" as="textarea" rows={3} defaultValue={user.bio} maxLength={1000} />
        <Field label="Skills & interests" name="skills" defaultValue={user.skills.join(", ")} help="Comma separated" />
        <input type="hidden" name="displayName" value={user.displayName} />
        {sp.type === "business" && <input type="hidden" name="next" value="/my/businesses/shop/new" />}
        <SubmitButton>Continue</SubmitButton>
      </ActionForm>
    </Container>
  );
}
