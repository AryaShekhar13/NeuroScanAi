import { FormEvent, useState } from "react";
import { ArrowUpRight, LoaderCircle, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import ClinicalShell from "@/components/ClinicalShell";
import { trpc } from "@/lib/trpc";

export default function PatientsPage() {
  const [search, setSearch] = useState(""); const [showForm, setShowForm] = useState(false); const [reference, setReference] = useState(""); const [name, setName] = useState(""); const utils = trpc.useUtils();
  const patients = trpc.patients.list.useQuery({ search: search || undefined });
  const create = trpc.patients.create.useMutation({ onSuccess: async () => { await utils.patients.list.invalidate(); setReference(""); setName(""); setShowForm(false); toast.success("Patient record created."); } });
  const submit = (event: FormEvent) => { event.preventDefault(); create.mutate({ patientReference: reference, displayName: name }); };
  return <ClinicalShell active="/patients"><main className="app-main"><div className="app-title-row"><div><p className="amber-label">CLINICAL RECORDS</p><h1>Patients</h1></div><button className="primary-action" type="button" onClick={() => setShowForm((open) => !open)}><Plus size={16} /> Add patient</button></div>{showForm && <form className="app-inline-form" onSubmit={submit}><label>Patient reference<input value={reference} onChange={(e) => setReference(e.target.value)} required maxLength={80} /></label><label>Display name<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={160} /></label><button className="primary-action" type="submit" disabled={create.isPending}>{create.isPending ? <LoaderCircle className="spin-icon" size={16} /> : "Save patient"}</button></form>}<label className="app-search"><Search size={16} /><span className="sr-only">Search patients</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search patients" /></label><section className="data-list" aria-label="Patient list">{patients.isLoading ? <p className="app-loading"><LoaderCircle className="spin-icon" size={18} /> Retrieving patients</p> : patients.data?.length ? patients.data.map((patient) => <a key={patient.id} href={`/patients/${patient.id}`} className="data-row"><span>{patient.displayName}</span><span>{patient.patientReference}</span><span>Open record <ArrowUpRight size={15} /></span></a>) : <p className="app-empty">No patients match this workspace. Use <strong>Add patient</strong> to create the first record.</p>}</section></main></ClinicalShell>;
}
