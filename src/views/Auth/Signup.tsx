import Link from "next/link";
import { useRouter } from "next/navigation";
import SignupForm from "../../components/auth/SignupForm";
import AuthShell from "../../components/auth/AuthShell";

const Signup = () => (
  <AuthShell
    eyebrow="Join Nexus"
    title="Create your account"
    subtitle="Plan trips, save places and take your maps offline."
    footer={
      <>
        Already registered?{" "}
        <Link  href="/login" className="font-semibold text-cyan-300 hover:text-cyan-200">
          Sign in
        </Link>
      </>
    }
  >
    <SignupForm />
  </AuthShell>
);

export default Signup;
