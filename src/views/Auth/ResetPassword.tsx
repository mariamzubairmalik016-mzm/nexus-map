import { useState, type FormEvent } from "react";
import { LockKeyhole } from "lucide-react";
import toast from "react-hot-toast";
import AuthShell from "../../components/auth/AuthShell";

const ResetPassword = () => {
  const [password, setPassword] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) return toast.error("Minimum 8 characters.");
    // Supabase has been removed. Password update API needs to be implemented.
    toast.success("Password updated (demo mode).");
  };

  return (
    <AuthShell eyebrow="Secure access" title="Create new password" subtitle="Choose a strong password of at least 8 characters.">
      <form onSubmit={submit}>
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4">
          <LockKeyhole className="text-cyan-400" size={19} />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="New password"
            className="min-w-0 flex-1 bg-transparent py-4 outline-none"
          />
        </div>
        <button className="nexus-button-primary mt-5 w-full">Update password</button>
      </form>
    </AuthShell>
  );
};

export default ResetPassword;
