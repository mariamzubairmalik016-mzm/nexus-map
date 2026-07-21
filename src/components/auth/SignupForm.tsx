import { useState, type FormEvent } from "react";
import { LoaderCircle, LockKeyhole, Mail, UserRound, type LucideIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../hooks/useAuth";

const SignupForm = () => {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("Mariam Zubair Malik");
  const [email, setEmail] = useState("mariam@example.com");
  const [password, setPassword] = useState("12345678");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSubmitting(true);
      await signUp(name.trim(), email.trim(), password);
      toast.success("Account created.");
      navigate("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign up.");
    } finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {(
        [
          { label: "Full name", value: name, setter: setName, Icon: UserRound, type: "text" },
          { label: "Email", value: email, setter: setEmail, Icon: Mail, type: "email" },
          { label: "Password", value: password, setter: setPassword, Icon: LockKeyhole, type: "password" },
        ] as Array<{ label: string; value: string; setter: (v: string) => void; Icon: LucideIcon; type: string }>
      ).map(({ label, value, setter, Icon, type }) => (
        <label key={label} className="block">
          <span className="mb-2 block text-sm text-slate-300">{label}</span>
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4">
            <Icon size={19} className="text-cyan-400" />
            <input type={type} value={value} onChange={(e) => setter(e.target.value)} className="min-w-0 flex-1 bg-transparent py-4 outline-none" />
          </div>
        </label>
      ))}
      <button disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-4 font-semibold">{submitting && <LoaderCircle className="animate-spin" size={19} />}{submitting ? "Creating..." : "Create account"}</button>
    </form>
  );
};
export default SignupForm;
