import { FormEvent, useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { NeuroLogo } from "@/components/NeuroLogo";
import { trpc } from "@/lib/trpc";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const request = trpc.clinicianAuth.forgotPassword.useMutation();
  const submit = (event: FormEvent) => { event.preventDefault(); request.mutate({ email }); };
  return <div className="neuro-auth-page"><div className="auth-fragments" aria-hidden="true" /><a className="auth-brand" href="/"><NeuroLogo /></a><main className="auth-main"><p className="amber-label">ACCOUNT RECOVERY</p><h1>Reset your password.</h1><p className="auth-subtitle">Enter the email associated with your NeuroScan AI account and we’ll send you a secure password reset link.</p><form className="auth-form" onSubmit={submit}><label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" autoComplete="email" required /></label>{request.error && <p className="auth-error" role="alert">We could not process that request. Please try again.</p>}<button className="primary-action" type="submit" disabled={request.isPending}>{request.isPending ? <LoaderCircle className="spin-icon" size={16} /> : <>Send reset link <ArrowRight size={16} /></>}</button></form>{request.isSuccess && <p className="auth-success">If an account exists for that email, a password reset link has been sent.</p>}<p className="auth-switch"><a href="/login">Back to sign in</a></p></main></div>;
}
