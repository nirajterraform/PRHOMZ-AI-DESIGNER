import React, { useState } from "react";
import { Mail, Lock, ArrowRight, ShieldCheck, Sparkles, ArrowLeft, CheckCircle2 } from "lucide-react";
import { Button } from "./Button";
import { signIn, signUp, sendReset, validatePassword, validateEmailFormat } from "../services/authService";

type View = "landing" | "signup" | "signin" | "forgot";

function describeAuthError(err: unknown): string {
  if (!(err instanceof Error)) return "Something went wrong. Please try again.";
  const msg = err.message.toLowerCase();
  if (msg.includes("email-already-in-use")) return "This email is already registered. Try signing in instead.";
  if (msg.includes("user-not-found")) return "No account found with this email.";
  if (msg.includes("wrong-password") || msg.includes("invalid-credential") || msg.includes("invalid-login-credentials"))
    return "Incorrect email or password.";
  if (msg.includes("weak-password")) return "Password is too weak. Use 8+ characters with at least one number.";
  if (msg.includes("too-many-requests")) return "Too many attempts. Please wait a minute and try again.";
  if (msg.includes("invalid-email")) return "Please enter a valid email address.";
  if (msg.includes("network-request-failed")) return "Network error. Check your connection.";
  return err.message;
}

export const Auth: React.FC = () => {
  const [view, setView] = useState<View>("landing");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetSent, setResetSent] = useState(false);

  const clearForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError(null);
    setResetSent(false);
  };

  const switchView = (v: View) => {
    clearForm();
    setView(v);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailError = validateEmailFormat(email);
    if (emailError) {
      setError(emailError);
      return;
    }
    const policyError = validatePassword(password);
    if (policyError) {
      setError(policyError);
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      await signUp(email, password);
      // App.tsx auth listener will route to EmailVerificationPending
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailError = validateEmailFormat(email);
    if (emailError) {
      setError(emailError);
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setIsLoading(true);
    try {
      await signIn(email, password);
      // App.tsx auth listener handles the rest
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailError = validateEmailFormat(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    setIsLoading(true);
    try {
      await sendReset(email);
      setResetSent(true);
    } catch (err) {
      setError(describeAuthError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const errorBlock = error && (
    <div className="bg-red-400/10 border border-red-400/30 rounded-xl px-4 py-3 text-red-400 text-xs font-bold uppercase tracking-widest">
      {error}
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-google-bg flex items-center justify-center overflow-hidden font-sans">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-google-blue/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03]" />
      </div>

      <div className="relative w-full max-w-xl px-6 animate-fade">
        <div className="text-center mb-12">
          <h1 className="text-6xl font-serif italic tracking-tighter text-google-dark mb-4">
            PRHOMZ <span className="text-google-blue not-italic font-sans font-black">AI</span>
          </h1>
          <p className="text-google-gray text-sm font-bold uppercase tracking-[0.4em] opacity-80">
            Inspiring Homes, Enriching Lives
          </p>
        </div>

        <div className="bg-google-surface border border-google-border rounded-[3rem] p-10 md:p-14 shadow-2xl backdrop-blur-2xl relative overflow-hidden">
          {view === "landing" && (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
              <div className="space-y-4">
                <h2 className="text-3xl font-bold text-google-dark leading-tight">
                  Reimagine your world with Spatial Intelligence.
                </h2>
                <p className="text-base text-google-gray leading-relaxed">
                  Join the elite community of designers and homeowners using generative AI to curate and shop perfect living spaces.
                </p>
              </div>

              <div className="space-y-4">
                <Button
                  onClick={() => switchView("signup")}
                  className="w-full py-5 rounded-2xl group/btn text-base shadow-xl"
                >
                  Create Account <ArrowRight size={20} className="ml-3 group-hover/btn:translate-x-2 transition-transform" />
                </Button>
                <button
                  type="button"
                  onClick={() => switchView("signin")}
                  className="w-full py-4 text-xs font-black uppercase tracking-[0.2em] text-google-gray hover:text-google-dark transition-colors"
                >
                  Already a member? Sign In
                </button>
              </div>

              <div className="pt-8 border-t border-google-border flex items-center justify-center space-x-8 opacity-50">
                <div className="flex items-center space-x-2">
                  <ShieldCheck size={18} />
                  <span className="text-xs font-bold uppercase tracking-widest">Secure Auth</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Sparkles size={18} />
                  <span className="text-xs font-bold uppercase tracking-widest">AI Workspace</span>
                </div>
              </div>
            </div>
          )}

          {view === "signup" && (
            <form onSubmit={handleSignUp} className="space-y-7 animate-in fade-in slide-in-from-right-6 duration-500">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-google-dark">Create your account</h2>
                <p className="text-sm text-google-gray">8+ characters with at least one number.</p>
              </div>

              <EmailField email={email} setEmail={setEmail} />
              <PasswordField password={password} setPassword={setPassword} autoComplete="new-password" />
              <PasswordField password={confirmPassword} setPassword={setConfirmPassword} placeholder="Confirm password" autoComplete="new-password" />

              {errorBlock}

              <Button
                type="submit"
                isLoading={isLoading}
                className="w-full py-5 rounded-2xl text-base shadow-xl"
                disabled={!email || !password || !confirmPassword}
              >
                {isLoading ? "Creating Account..." : "Create Account"}
              </Button>

              <button
                type="button"
                onClick={() => switchView("landing")}
                className="w-full text-xs font-black uppercase tracking-[0.2em] text-google-gray hover:text-google-dark transition-colors flex items-center justify-center"
              >
                <ArrowLeft size={14} className="mr-2" /> Back
              </button>
            </form>
          )}

          {view === "signin" && (
            <form onSubmit={handleSignIn} className="space-y-7 animate-in fade-in slide-in-from-right-6 duration-500">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-google-dark">Welcome back</h2>
                <p className="text-sm text-google-gray">Sign in to your atelier.</p>
              </div>

              <EmailField email={email} setEmail={setEmail} />
              <PasswordField password={password} setPassword={setPassword} autoComplete="current-password" />

              <div className="flex justify-end -mt-3">
                <button
                  type="button"
                  onClick={() => switchView("forgot")}
                  className="text-xs font-bold uppercase tracking-widest text-google-gray hover:text-google-blue transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              {errorBlock}

              <Button
                type="submit"
                isLoading={isLoading}
                className="w-full py-5 rounded-2xl text-base shadow-xl"
                disabled={!email || !password}
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </Button>

              <button
                type="button"
                onClick={() => switchView("landing")}
                className="w-full text-xs font-black uppercase tracking-[0.2em] text-google-gray hover:text-google-dark transition-colors flex items-center justify-center"
              >
                <ArrowLeft size={14} className="mr-2" /> Back
              </button>
            </form>
          )}

          {view === "forgot" && (
            <form onSubmit={handleForgot} className="space-y-7 animate-in fade-in slide-in-from-right-6 duration-500">
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-google-dark">Reset password</h2>
                <p className="text-sm text-google-gray">
                  Enter your email and we'll send you a link to reset your password.
                </p>
              </div>

              <EmailField email={email} setEmail={setEmail} />

              {errorBlock}

              {resetSent ? (
                <div className="bg-google-blue/10 border border-google-blue/20 rounded-xl px-4 py-4 flex items-start space-x-3 text-google-blue">
                  <CheckCircle2 size={20} className="flex-shrink-0 mt-0.5" />
                  <div className="text-xs font-bold uppercase tracking-widest leading-relaxed">
                    Check your inbox. We sent a reset link to {email}.
                  </div>
                </div>
              ) : (
                <Button
                  type="submit"
                  isLoading={isLoading}
                  className="w-full py-5 rounded-2xl text-base shadow-xl"
                  disabled={!email}
                >
                  {isLoading ? "Sending..." : "Send Reset Link"}
                </Button>
              )}

              <button
                type="button"
                onClick={() => switchView("signin")}
                className="w-full text-xs font-black uppercase tracking-[0.2em] text-google-gray hover:text-google-dark transition-colors flex items-center justify-center"
              >
                <ArrowLeft size={14} className="mr-2" /> Back to sign in
              </button>
            </form>
          )}
        </div>

        <p className="mt-10 text-center text-xs text-google-gray font-bold uppercase tracking-[0.2em] opacity-40">
          PRHOMZ Systems • Terms of Design apply
        </p>
      </div>
    </div>
  );
};

interface FieldProps {
  email?: string;
  setEmail?: (v: string) => void;
  password?: string;
  setPassword?: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}

const EmailField: React.FC<FieldProps> = ({ email, setEmail }) => (
  <div className="relative group/input">
    <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-google-gray group-focus-within/input:text-google-blue transition-colors">
      <Mail size={22} />
    </div>
    <input
      type="email"
      required
      value={email}
      onChange={(e) => setEmail?.(e.target.value)}
      placeholder="name@example.com"
      autoComplete="email"
      className="w-full bg-google-bg border border-google-border rounded-2xl py-5 pl-16 pr-8 text-base focus:ring-2 focus:ring-google-blue focus:outline-none focus:border-google-blue transition-all text-google-dark placeholder-google-gray shadow-inner"
    />
  </div>
);

const PasswordField: React.FC<FieldProps> = ({
  password,
  setPassword,
  placeholder = "Password",
  autoComplete = "current-password",
}) => (
  <div className="relative group/input">
    <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-google-gray group-focus-within/input:text-google-blue transition-colors">
      <Lock size={22} />
    </div>
    <input
      type="password"
      required
      value={password}
      onChange={(e) => setPassword?.(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      className="w-full bg-google-bg border border-google-border rounded-2xl py-5 pl-16 pr-8 text-base focus:ring-2 focus:ring-google-blue focus:outline-none focus:border-google-blue transition-all text-google-dark placeholder-google-gray shadow-inner"
    />
  </div>
);
