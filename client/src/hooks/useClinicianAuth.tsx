import { useEffect } from "react";
import { trpc } from "@/lib/trpc";

export function useClinicianAuth() {
  const query = trpc.clinicianAuth.me.useQuery(undefined, { retry: false, staleTime: 60_000 });
  const utils = trpc.useUtils();
  const logoutMutation = trpc.clinicianAuth.logout.useMutation({
    onSuccess: async () => { await utils.clinicianAuth.me.invalidate(); window.location.assign("/login"); },
  });
  return { clinician: query.data ?? null, loading: query.isLoading, error: query.error, logout: () => logoutMutation.mutate(), loggingOut: logoutMutation.isPending, refresh: query.refetch };
}

export function ClinicianRouteGuard({ children }: { children: React.ReactNode }) {
  const { clinician, loading } = useClinicianAuth();
  useEffect(() => { if (!loading && !clinician) window.location.replace("/login"); }, [clinician, loading]);
  if (loading || !clinician) return <div className="clinical-gate" aria-live="polite">Verifying secure session…</div>;
  return <>{children}</>;
}

export function ClinicianAdminRouteGuard({ children }: { children: React.ReactNode }) {
  const { clinician, loading } = useClinicianAuth();
  useEffect(() => { if (!loading && !clinician) window.location.replace("/login"); else if (!loading && clinician?.role !== "admin") window.location.replace("/app"); }, [clinician, loading]);
  if (loading || !clinician) return <div className="clinical-gate" aria-live="polite">Verifying administrator authorization…</div>;
  if (clinician.role !== "admin") return <div className="clinical-gate" role="alert">Administrator authorization is required.</div>;
  return <>{children}</>;
}
