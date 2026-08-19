import { FormEvent, useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { NeuroLogo } from "@/components/NeuroLogo";
import { trpc } from "@/lib/trpc";

export default function ResetPasswordPage() {
  const token = new URLSearchParams(window.location.search).get("token") || ""; const [password, setPassword] = useState(""); const [message, setMessage] = useState<string | null>(null);
  const reset = trpc.clinicianAuth.resetPassword.useMutation({ onSuccess: () => window.location.assign("/app"), onError: (error) => setMessage(error.message) });
  const submit = (event: FormEvent) => { event.preventDefault(); if (!token) { setMessage("That reset link is invalid."); return; } reset.mutate({ token, password }); };
  return <div className="neuro-auth-page"><div className="auth-fragments" aria-hidden="true" /><a className="auth-brand" href="/"><NeuroLogo /></a><main className="auth-main"><p className="amber-label">ACCOUNT RECOVERY</p><h1>Choose a new password.</h1><p className="auth-subtitle">Use at least eight characters to protect your clinical workspace.</p><form className="auth-form" onSubmit={submit}><label>New password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength={8} autoComplete="new-password" required /></label>{message && <p className="auth-error" role="alert">{message}</p>}<button className="primary-action" type="submit" disabled={reset.isPending}>{reset.isPending ? <LoaderCircle className="spin-icon" size={16} /> : <>Reset password <ArrowRight size={16} /></>}</button></form></main></div>;
}
