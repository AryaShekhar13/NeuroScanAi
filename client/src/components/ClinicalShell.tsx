import { LogOut } from "lucide-react";
import { NeuroLogo } from "@/components/NeuroLogo";
import { useClinicianAuth } from "@/hooks/useClinicianAuth";

const baseLinks = [
  ["Dashboard", "/app"], ["Patients", "/patients"], ["MRI Studies", "/studies"], ["Analysis", "/analysis"], ["Settings", "/settings"],
] as const;

export default function ClinicalShell({ active, children }: { active: string; children: React.ReactNode }) {
  const { clinician, logout, loggingOut } = useClinicianAuth();
  const links = clinician?.role === "admin" ? [...baseLinks, ["Admin", "/admin"] as const] : baseLinks;
  return <div className="clinical-page app-shell">
    <header className="clinical-header">
      <a href="/" className="clinical-brand"><NeuroLogo /></a>
      <nav aria-label="Clinical application navigation">{links.map(([label, href]) => <a key={href} href={href} aria-current={active === href ? "page" : undefined}>{label}</a>)}</nav>
      <div className="clinician-profile"><span>Dr. {clinician?.fullName ?? "Clinician"}</span><button type="button" onClick={logout} disabled={loggingOut}>Logout <LogOut size={14} strokeWidth={1.5} /></button></div>
    </header>
    {children}
  </div>;
}
