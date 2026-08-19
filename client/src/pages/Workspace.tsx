import { ArrowLeft, ArrowUpRight, FileText, LoaderCircle, LogOut, Upload } from "lucide-react";
import { ChangeEvent, useState } from "react";
import { toast } from "sonner";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";

const maxUploadBytes = 8 * 1024 * 1024;
const acceptedTypes = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The selected file could not be read."));
    reader.onload = () => {
      const value = typeof reader.result === "string" ? reader.result.split(",")[1] : undefined;
      if (!value) reject(new Error("The selected file could not be prepared."));
      else resolve(value);
    };
    reader.readAsDataURL(file);
  });
}

function formatDate(value: Date | string) {
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function Workspace() {
  const { user, isAuthenticated, logout } = useAuth();
  const [isPreparing, setIsPreparing] = useState(false);
  const fileQuery = trpc.workspaceFiles.list.useQuery(undefined, { enabled: isAuthenticated });
  const utils = trpc.useUtils();
  const upload = trpc.workspaceFiles.upload.useMutation({
    onSuccess: async () => {
      await utils.workspaceFiles.list.invalidate();
      toast.success("Source stored in your workspace.");
    },
    onError: (error) => toast.error(error.message || "The file could not be stored."),
  });

  const handleFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!acceptedTypes.includes(file.type)) {
      toast.error("Choose a PDF, DOCX, TXT, Markdown, or CSV file.");
      return;
    }
    if (file.size > maxUploadBytes) {
      toast.error("Files must be 8 MB or smaller.");
      return;
    }

    try {
      setIsPreparing(true);
      const base64 = await readFileAsBase64(file);
      upload.mutate({ fileName: file.name, mimeType: file.type, base64 });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "The selected file could not be prepared.");
    } finally {
      setIsPreparing(false);
    }
  };

  const isBusy = isPreparing || upload.isPending;

  return (
    <div className="workspace-page">
      <header className="workspace-header">
        <a href="/" className="brand-lockup" aria-label="Return to Dala home">
          <img src="/manus-storage/dala-logo-mark_e0a5fb13.png" alt="" className="brand-mark" />
          <span>Dala</span>
        </a>
        {isAuthenticated && (
          <button type="button" className="workspace-logout" onClick={() => void logout()}>
            Sign out <LogOut size={15} strokeWidth={1.5} />
          </button>
        )}
      </header>

      <main className="workspace-main">
        <img className="workspace-atmosphere" src="/manus-storage/dala-constellation-field_7059d0bf.png" alt="" aria-hidden="true" />
        <a href="/" className="workspace-back"><ArrowLeft size={15} strokeWidth={1.5} /> Back to the field</a>
        {!isAuthenticated ? (
          <section className="workspace-intro" aria-labelledby="workspace-title">
            <p className="amber-label">PRIVATE WORKSPACE</p>
            <h1 id="workspace-title">Give shared intelligence a source.</h1>
            <p>
              Sign in to store research, notes, and reference documents in your Dala workspace. Each file is saved securely and remains available to your account.
            </p>
            <button type="button" className="primary-action" onClick={startLogin}>
              Sign in to continue <ArrowUpRight size={16} strokeWidth={1.7} />
            </button>
          </section>
        ) : (
          <section className="workspace-intro workspace-authenticated" aria-labelledby="workspace-title">
            <p className="amber-label">{user?.name ? `${user.name}'s workspace` : "PRIVATE WORKSPACE"}</p>
            <h1 id="workspace-title">Sources, kept close.</h1>
            <p>Store the documents that give your team’s knowledge its context. PDF, DOCX, TXT, Markdown, and CSV files up to 8 MB are supported.</p>

            <div className="upload-line">
              <label className={`upload-trigger${isBusy ? " is-busy" : ""}`}>
                {isBusy ? <LoaderCircle size={17} className="spin-icon" /> : <Upload size={17} strokeWidth={1.6} />}
                <span>{isBusy ? "Storing source…" : "Choose a source to store"}</span>
                <input type="file" accept=".pdf,.docx,.txt,.md,.markdown,.csv,application/pdf,text/plain,text/markdown,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={handleFile} disabled={isBusy} />
              </label>
              <span>8 MB maximum</span>
            </div>

            <div className="source-list" aria-live="polite">
              <div className="source-list-title"><span>Stored sources</span><span>{fileQuery.data?.length ?? 0}</span></div>
              {fileQuery.isLoading ? (
                <p className="source-status"><LoaderCircle size={16} className="spin-icon" /> Retrieving your sources</p>
              ) : fileQuery.isError ? (
                <p className="source-status error-text">Your sources could not be retrieved. Please refresh and try again.</p>
              ) : fileQuery.data?.length ? (
                fileQuery.data.map((file) => (
                  <a className="source-row" key={file.id} href={file.url} target="_blank" rel="noreferrer">
                    <FileText size={18} strokeWidth={1.4} />
                    <span className="source-name">{file.originalName}</span>
                    <span className="source-meta">{formatDate(file.createdAt)}</span>
                    <ArrowUpRight size={16} strokeWidth={1.4} />
                  </a>
                ))
              ) : (
                <p className="source-status">No sources yet. The first document you store will appear here.</p>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
