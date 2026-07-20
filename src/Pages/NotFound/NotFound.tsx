import { Home, Map } from "lucide-react";
import { Link } from "react-router-dom";
const NotFound = () => <section className="flex min-h-[calc(100vh-80px)] items-center justify-center px-4"><div className="max-w-2xl text-center"><Map className="mx-auto text-cyan-400" size={54} /><p className="mt-6 text-sm uppercase tracking-[.3em] text-cyan-400">Error 404</p><h1 className="mt-3 text-5xl font-bold">Page not found</h1><p className="mt-4 text-slate-400">The requested page does not exist.</p><Link to="/" className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-cyan-500 px-6 py-3 font-semibold text-slate-950"><Home size={18} />Go Home</Link></div></section>;
export default NotFound;
