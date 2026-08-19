import { ArrowUpRight, LoaderCircle } from "lucide-react";
import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export default function AccessRequestForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);

  const requestAccess = trpc.accessRequests.create.useMutation({
    onSuccess: () => {
      toast.success("Your access request has been recorded.");
      setName("");
      setEmail("");
      setCompany("");
      setMessage("");
      setOpen(false);
    },
    onError: (error) => toast.error(error.message || "We could not save your request. Please try again."),
  });

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    requestAccess.mutate({ name, email, company: company || undefined, message: message || undefined });
  };

  if (!open) {
    return (
      <button type="button" className="primary-action" onClick={() => setOpen(true)}>
        Start a conversation <ArrowUpRight size={16} strokeWidth={1.7} />
      </button>
    );
  }

  return (
    <form className="access-form" onSubmit={onSubmit}>
      <label>
        <span>Name</span>
        <input value={name} onChange={(event) => setName(event.target.value)} required maxLength={120} />
      </label>
      <label>
        <span>Work email</span>
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={320} />
      </label>
      <label>
        <span>Company <em>optional</em></span>
        <input value={company} onChange={(event) => setCompany(event.target.value)} maxLength={160} />
      </label>
      <label>
        <span>What are you trying to make easier? <em>optional</em></span>
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} maxLength={2000} rows={3} />
      </label>
      <div className="access-form-actions">
        <button type="submit" className="primary-action" disabled={requestAccess.isPending}>
          {requestAccess.isPending ? <LoaderCircle size={16} className="spin-icon" /> : <>Send request <ArrowUpRight size={16} strokeWidth={1.7} /></>}
        </button>
        <button type="button" className="plain-action" onClick={() => setOpen(false)} disabled={requestAccess.isPending}>
          Cancel
        </button>
      </div>
    </form>
  );
}
