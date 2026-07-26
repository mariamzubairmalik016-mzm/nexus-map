import { useState, type FormEvent } from "react";
import { LoaderCircle, LockKeyhole, Mail, UserRound, type LucideIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

const SignupForm = () => {
  const navigate = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSubmitting(true);

      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to sign up.");
      }

      toast.success("Account created successfully. Please sign in.");
      navigate.push("/login");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign up.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      {(
        [
          { label: "Full name", value: name, setter: setName, Icon: UserRound, type: "text" },
          { label: "Email", value: email, setter: setEmail, Icon: Mail, type: "email" },
          {
            label: "Password",
            value: password,
            setter: setPassword,
            Icon: LockKeyhole,
            type: "password",
          },
        ] as Array<{
          label: string;
          value: string;
          setter: (v: string) => void;
          Icon: LucideIcon;
          type: string;
        }>
      ).map(({ label, value, setter, Icon, type }) => (
        <label key={label} className="block">
          <span className="mb-2 block text-sm font-medium text-slate-300">{label}</span>
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-slate-950/60 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all duration-300 focus-within:border-cyan-400/30 focus-within:shadow-[0_0_0_4px_rgba(34,211,238,0.06)]">
            <Icon size={19} className="text-cyan-400" />
            <input
              type={type}
              value={value}
              onChange={(e) => setter(e.target.value)}
              className="min-w-0 flex-1 bg-transparent py-4 outline-none"
            />
          </div>
        </label>
      ))}

      <button
        disabled={submitting}
        className="nexus-button-primary w-full py-4"
      >
        {submitting && <LoaderCircle className="animate-spin" size={19} />}
        {submitting ? "Creating..." : "Create account"}
      </button>
    </form>
  );
};

export default SignupForm;
