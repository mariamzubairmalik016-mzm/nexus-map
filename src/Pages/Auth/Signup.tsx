import { Link } from "react-router-dom";
import SignupForm from "../../components/auth/SignupForm";
const Signup = () => <section className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4 py-16"><div className="w-full max-w-md rounded-[32px] border border-white/10 bg-white/[.05] p-7 shadow-2xl backdrop-blur-3xl"><p className="text-center text-sm uppercase tracking-[.25em] text-cyan-400">Join Nexus</p><h1 className="mt-3 text-center text-3xl font-bold">Create your account</h1><div className="mt-8"><SignupForm /></div><p className="mt-6 text-center text-sm text-slate-400">Already registered? <Link to="/login" className="text-cyan-300">Sign in</Link></p></div></section>;
export default Signup;
