import Link from "next/link";

import LoginForm from "../../components/auth/LoginForm";
import AuthShell from "../../components/auth/AuthShell";

/**
 * The "Forgot your password?" line that sat under the form is gone — LoginForm
 * already renders one directly beneath the password field, where it is useful.
 * Two links to the same page a few pixels apart only made the footer ambiguous.
 */
const Login = () => (
  <AuthShell
    eyebrow="Welcome back"
    title="Sign in to Nexus"
    subtitle="Access your maps, saved routes and offline downloads."
    footer={
      <>
        New here?{" "}
        <Link href="/signup" className="font-semibold text-cyan-300 hover:text-cyan-200">
          Create account
        </Link>
      </>
    }
  >
    <LoginForm />
  </AuthShell>
);

export default Login;
