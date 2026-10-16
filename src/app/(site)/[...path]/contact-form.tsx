"use client";
import { ActionForm, Field, SubmitButton } from "@/components/ui/form";
import { contactAction } from "./actions";

export function ContactForm() {
  return (
    <ActionForm action={contactAction} className="card mt-8 space-y-4 p-5" resetOnSuccess>
      <h2 className="text-lg">Send us a message</h2>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Your name" name="name" required maxLength={80} autoComplete="name" /><Field label="Email" name="email" type="email" required autoComplete="email" /></div>
      <Field label="Subject" name="subject" required maxLength={120} />
      <Field label="Message" name="message" as="textarea" rows={6} required maxLength={4000} />
      <div className="hidden" aria-hidden><label>Leave this empty<input name="website" tabIndex={-1} autoComplete="off" /></label></div>
      <SubmitButton>Send message</SubmitButton>
    </ActionForm>
  );
}
