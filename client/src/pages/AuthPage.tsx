import { FormEvent, useState } from "react";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { NeuroLogo } from "@/components/NeuroLogo";
import { trpc } from "@/lib/trpc";

type Props = { mode: "login" | "signup" };

export default function AuthPage({ mode }: Props) {
  const isSignUp = mode === "signup";
  const utils = trpc.useUtils();
  const [form, setForm] = useState({ fullName: "", email: "", professionalRole: "", institution: "", password: "", confirmPassword: "" });
  const signup = trpc.clinicianAuth.signup.useMutation({ onSuccess: async () => { await utils.clinicianAuth.me.invalidate(); window.location.assign("/app"); } });
  const login = trpc.clinicianAuth.login.useMutation({ onSuccess: async () => { await utils.clinicianAuth.me.invalidate(); window.location.assign("/app"); } });
  const pending = signup.isPending || login.isPending;
  const setField = (field: keyof typeof form, value: string) => setForm((current) => ({ ...current, [field]: value }));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSignUp) {
      if (form.password !== form.confirmPassword) { toast.error("Passwords do not match."); return; }
      signup.mutate({ fullName: form.fullName, email: form.email, professionalRole: form.professionalRole, institution: form.institution, password: form.password });
    } else login.mutate({ email: form.email, password: form.password });
  };
  const error = (isSignUp ? signup.error : login.error)?.message;
  return <div className="neuro-auth-page"><div className="auth-fragments" aria-hidden="true" /><a className="auth-brand" href="/"><NeuroLogo /></a><main className="auth-main">
    <p className="amber-label">CLINICAL WORKSPACE</p><h1>{isSignUp ? "Create your workspace." : "Welcome back."}</h1><p className="auth-subtitle">{isSignUp ? "Built for focused MRI review and AI-assisted analysis." : "Sign in to your clinical workspace."}</p>
    <form className="auth-form" onSubmit={submit}>
      {isSignUp && <label>Full name<input value={form.fullName} onChange={(e) => setField("fullName", e.target.value)} autoComplete="name" required /></label>}
      <label>Email<input value={form.email} onChange={(e) => setField("email", e.target.value)} type="email" autoComplete="email" required /></label>
      {isSignUp && <label>Professional role<input value={form.professionalRole} onChange={(e) => setField("professionalRole", e.target.value)} autoComplete="organization-title" required /></label>}
      {isSignUp && <label>Institution<input value={form.institution} onChange={(e) => setField("institution", e.target.value)} autoComplete="organization" required /></label>}
      <label>Password<input value={form.password} onChange={(e) => setField("password", e.target.value)} type="password" autoComplete={isSignUp ? "new-password" : "current-password"} minLength={8} required /></label>
      {isSignUp && <label>Confirm password<input value={form.confirmPassword} onChange={(e) => setField("confirmPassword", e.target.value)} type="password" autoComplete="new-password" minLength={8} required /></label>}
      {!isSignUp && <a href="/forgot-password" className="auth-forgot">Forgot password?</a>}
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button className="primary-action" type="submit" disabled={pending}>{pending ? <LoaderCircle className="spin-icon" size={16} /> : <>{isSignUp ? "Create account" : "Sign in"} <ArrowRight size={16} strokeWidth={1.6} /></>}</button>
    </form>
    <p className="auth-switch">{isSignUp ? "Already have an account?" : "Don’t have an account?"} <a href={isSignUp ? "/login" : "/signup"}>{isSignUp ? "Sign in" : "Create one"}</a></p>
  </main></div>;
}
