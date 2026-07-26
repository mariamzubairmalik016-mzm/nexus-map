import Link from "next/link";
import { useRouter } from "next/navigation";
import LoginForm from "../../components/auth/LoginForm";
import AuthShell from "../../components/auth/AuthShell";

const Login = () => (
  <AuthShell
    eyebrow="Welcome back"
    title="Sign in to Nexus"
    subtitle="Access your maps, saved routes and offline downloads."
    footer={
      <>
        New here?{" "}
        <Link  href="/signup" className="font-semibold text-cyan-300 hover:text-cyan-200">
          Create account
        </Link>
      </>
    }
  >
    <LoginForm />
    <p className="mt-4 text-center text-xs text-slate-500">
      <Link  href="/forgot-password" className="hover:text-slate-300">
        Forgot your password?
      </Link>
    </p>
  </AuthShell>
);

export default Login;
