import ClinicalShell from "@/components/ClinicalShell";
import { useClinicianAuth } from "@/hooks/useClinicianAuth";

export default function SettingsPage() { const { clinician } = useClinicianAuth(); return <ClinicalShell active="/settings"><main className="app-main"><p className="amber-label">ACCOUNT</p><h1>Settings</h1><section className="settings-list"><div><span>Name</span><strong>Dr. {clinician?.fullName}</strong></div><div><span>Email</span><strong>{clinician?.email}</strong></div><div><span>Professional role</span><strong>{clinician?.professionalRole}</strong></div><div><span>Institution</span><strong>{clinician?.institution}</strong></div></section></main></ClinicalShell>; }
