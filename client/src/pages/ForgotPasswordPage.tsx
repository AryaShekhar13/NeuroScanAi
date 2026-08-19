import { FormEvent, useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { NeuroLogo } from "@/components/NeuroLogo";
import { trpc } from "@/lib/trpc";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [developmentLink, setDevelopmentLink] = useState<string | null>(null);
  const request = trpc.clinicianAuth.forgotPassword.useMutation({ onSuccess: (data) => { if (data.developmentResetToken) setDevelopmentLink(`/reset-password?token=${data.developmentResetToken}`); } });
  const submit = (event: FormEvent) => { event.preventDefault(); request.mutate({ email }); };
  return <div className="neuro-auth-page"><div className="auth-fragments" aria-hidden="true" /><a className="auth-brand" href="/"><NeuroLogo /></a><main className="auth-main"><p className="amber-label">ACCOUNT RECOVERY</p><h1>Reset your password.</h1><p className="auth-subtitle">Enter your email and we’ll prepare a secure reset link.</p><form className="auth-form" onSubmit={submit}><label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoComplete="email" required /></label><button className="primary-action" type="submit" disabled={request.isPending}>{request.isPending ? <LoaderCircle className="spin-icon" size={16} /> : <>Send reset link <ArrowRight size={16} /></>}</button></form>{request.isSuccess && <p className="auth-success">If this account exists, a reset link has been prepared.</p>}{developmentLink && <p className="auth-success">Development mail preview: <a href={developmentLink}>open reset link</a></p>}<p className="auth-switch"><a href="/login">Back to sign in</a></p></main></div>;
}
