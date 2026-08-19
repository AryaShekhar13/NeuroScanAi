import { FormEvent, useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { NeuroLogo } from "@/components/NeuroLogo";
import { trpc } from "@/lib/trpc";

export default function ResetPasswordPage() {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const [password, setPassword] = useState(""); const [confirmation, setConfirmation] = useState(""); const [message, setMessage] = useState<string | null>(null); const [complete, setComplete] = useState(false);
  const reset = trpc.clinicianAuth.resetPassword.useMutation({ onSuccess: () => setComplete(true), onError: (error) => setMessage(error.message) });
  const submit = (event: FormEvent) => { event.preventDefault(); setMessage(null); if (!token) { setMessage("That reset link is invalid."); return; } if (password !== confirmation) { setMessage("New password and confirmation do not match."); return; } reset.mutate({ token, password }); };
  return <div className="neuro-auth-page"><div className="auth-fragments" aria-hidden="true" /><a className="auth-brand" href="/"><NeuroLogo /></a><main className="auth-main"><p className="amber-label">ACCOUNT RECOVERY</p><h1>Create a new password.</h1><p className="auth-subtitle">Use at least 10 characters including a letter and a number to protect your clinical workspace.</p>{complete ? <div className="auth-complete"><p className="auth-success">Your password has been updated.</p><a href="/login" className="primary-action">Sign in <ArrowRight size={16} /></a></div> : <form className="auth-form" onSubmit={submit}><label>New password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" minLength={10} autoComplete="new-password" required /></label><label>Confirm new password<input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} type="password" minLength={10} autoComplete="new-password" required /></label>{message && <p className="auth-error" role="alert">{message}</p>}<button className="primary-action" type="submit" disabled={reset.isPending}>{reset.isPending ? <LoaderCircle className="spin-icon" size={16} /> : <>Reset password <ArrowRight size={16} /></>}</button></form>}</main></div>;
}
