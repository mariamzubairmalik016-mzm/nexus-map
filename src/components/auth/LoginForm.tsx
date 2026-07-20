import { useState, type FormEvent } from "react";
import { Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { useAuth } from "../../hooks/useAuth";

const LoginForm = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("mariam@example.com");
  const [password, setPassword] = useState("12345678");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      setSubmitting(true);
      await signIn(email.trim(), password);
      toast.success("Login successful.");
      navigate("/dashboard");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to login.");
    } finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={submit} className="space-y-5">
      <label className="block"><span className="mb-2 block text-sm text-slate-300">Email</span><div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4"><Mail size={19} className="text-cyan-400" /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="min-w-0 flex-1 bg-transparent py-4 outline-none" /></div></label>
      <label className="block"><span className="mb-2 block text-sm text-slate-300">Password</span><div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4"><LockKeyhole size={19} className="text-cyan-400" /><input type={show ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="min-w-0 flex-1 bg-transparent py-4 outline-none" /><button type="button" onClick={() => setShow(!show)}>{show ? <EyeOff size={19} /> : <Eye size={19} />}</button></div></label>
      <div className="text-right"><Link to="/forgot-password" className="text-sm text-cyan-300">Forgot password?</Link></div>
      <button disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 px-6 py-4 font-semibold">{submitting && <LoaderCircle className="animate-spin" size={19} />}{submitting ? "Signing in..." : "Sign in"}</button>
    </form>
  );
};
export default LoginForm;
