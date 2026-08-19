import { FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { startLogin } from "@/const";
import { NeuroLogo } from "@/components/NeuroLogo";

type Props = { mode: "signin" | "signup" };

export default function AuthPage({ mode }: Props) {
  const isSignUp = mode === "signup";
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    toast.message("Continuing to secure workspace authentication.");
    startLogin();
  };

  return (
    <div className="neuro-auth-page">
      <div className="auth-fragments" aria-hidden="true" />
      <a className="auth-brand" href="/"><NeuroLogo /></a>
      <main className="auth-main">
        <p className="amber-label">CLINICAL WORKSPACE</p>
        <h1>{isSignUp ? "Create your workspace." : "Welcome back."}</h1>
        <p className="auth-subtitle">
          {isSignUp
            ? "Built for focused MRI review and AI-assisted analysis."
            : "Sign in to your clinical workspace."}
        </p>
        <form className="auth-form" onSubmit={submit}>
          {isSignUp && <label>Full name<input name="name" autoComplete="name" required /></label>}
          <label>Email<input name="email" type="email" autoComplete="email" required /></label>
          {isSignUp && <label>Professional role<input name="role" autoComplete="organization-title" required /></label>}
          {isSignUp && <label>Institution<input name="institution" autoComplete="organization" required /></label>}
          <label>Password<input name="password" type="password" autoComplete={isSignUp ? "new-password" : "current-password"} required /></label>
          {isSignUp && <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" required /></label>}
          {!isSignUp && <a href="/signin" className="auth-forgot">Forgot password?</a>}
          <button className="primary-action" type="submit">
            {isSignUp ? "Create account" : "Sign in"} <ArrowRight size={16} strokeWidth={1.6} />
          </button>
        </form>
        <p className="auth-switch">
          {isSignUp ? "Already have an account?" : "Don’t have an account?"} <a href={isSignUp ? "/signin" : "/create-account"}>{isSignUp ? "Sign in" : "Create one"}</a>
        </p>
      </main>
    </div>
  );
}
