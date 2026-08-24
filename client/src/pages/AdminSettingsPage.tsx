import { FormEvent, useEffect, useState } from "react";
import { Save } from "lucide-react";
import ClinicalShell from "@/components/ClinicalShell";
import { trpc } from "@/lib/trpc";

export default function AdminSettingsPage() {
  const settings = trpc.admin.settings.useQuery(); const utils = trpc.useUtils(); const [apiUrl, setApiUrl] = useState("");
  useEffect(() => { if (settings.data?.configuration.inferenceApiBaseUrl) setApiUrl(settings.data.configuration.inferenceApiBaseUrl); }, [settings.data]);
  const save = trpc.admin.updateApiUrl.useMutation({ onSuccess: async () => { await Promise.all([settings.refetch(), utils.admin.overview.invalidate()]); } });
  const submit = (event: FormEvent) => { event.preventDefault(); save.mutate({ apiUrl }); };
  return <ClinicalShell active="/admin"><main className="app-main admin-page"><p className="amber-label">ADMIN SETTINGS</p><h1>MRI API configuration</h1><p className="app-subtitle">This URL is stored server-side and used by the application backend. It is not exposed to unauthenticated visitors or ordinary clinical users.</p><form className="admin-panel admin-settings-form" onSubmit={submit}><label htmlFor="mri-api-url">MRI API URL<input id="mri-api-url" type="url" value={apiUrl} onChange={(event) => setApiUrl(event.target.value)} placeholder="Not configured" required autoComplete="off" /></label><p className="admin-connection-note">No API URL is configured. When a real HTTPS service is available, save it here and use the dashboard’s connection test to record availability and model details.</p>{save.error && <p className="auth-error" role="alert">{save.error.message}</p>}<button className="primary-action" type="submit" disabled={save.isPending || !apiUrl.trim()}><Save size={16} /> {save.isPending ? "Saving secure configuration" : "Save MRI API URL"}</button></form></main></ClinicalShell>;
}
