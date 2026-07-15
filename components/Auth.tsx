import React, { useMemo, useRef, useState } from "react";
import {
  Mail,
  Lock,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  User,
  MapPin,
  Globe,
  ChevronDown,
} from "lucide-react";
import { Button } from "./Button";
import { signIn, signUp, sendReset, validatePassword, validateEmailFormat } from "../services/authService";
import { TermsModal, type LegalDocKind } from "./TermsModal";
import {
  GENDER_OPTIONS,
  AGE_RANGE_OPTIONS,
  COUNTRIES,
  validateSignupProfile,
  type SignupProfile,
} from "../shared/profile";

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
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [legalModal, setLegalModal] = useState<LegalDocKind | null>(null);

  // Signup profile fields (all mandatory).
  const [username, setUsername] = useState("");
  const [gender, setGender] = useState("");
  const [ageRange, setAgeRange] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [country, setCountry] = useState("");

  const clearForm = () => {
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setError(null);
    setResetSent(false);
    setAcceptedTerms(false);
    setAcceptedPrivacy(false);
    setUsername("");
    setGender("");
    setAgeRange("");
    setZipCode("");
    setCountry("");
  };

  const switchView = (v: View) => {
    clearForm();
    setView(v);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const profile: SignupProfile = {
      username: username.trim(),
      gender,
      ageRange,
      zipCode: zipCode.trim(),
      country,
    };
    const profileError = validateSignupProfile(profile);
    if (profileError) {
      setError(profileError);
      return;
    }
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
      await signUp(email, password, profile);
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
          <h1 className="text-3xl md:text-4xl font-serif italic tracking-tighter text-google-dark mb-4 whitespace-nowrap">
            PRHOMZ <span className="text-google-blue not-italic font-sans font-black">AI DESIGNER</span>
          </h1>
          <p className="text-google-gray text-sm font-bold uppercase tracking-[0.4em] opacity-80">
            Decor Design Delivered
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
                <p className="text-sm text-google-gray">All fields are required.</p>
              </div>

              <TextField
                value={username}
                setValue={setUsername}
                placeholder="Username"
                icon={<User size={22} />}
                autoComplete="username"
                maxLength={20}
              />
              <EmailField email={email} setEmail={setEmail} />

              <div className="grid grid-cols-2 gap-4">
                <SelectField value={gender} setValue={setGender} placeholder="Gender" options={GENDER_OPTIONS} />
                <SelectField value={ageRange} setValue={setAgeRange} placeholder="Age" options={AGE_RANGE_OPTIONS} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <TextField
                  value={zipCode}
                  setValue={setZipCode}
                  placeholder="Zip / Postal"
                  icon={<MapPin size={22} />}
                  autoComplete="postal-code"
                  maxLength={10}
                />
                <CountryField value={country} setValue={setCountry} />
              </div>

              <PasswordField password={password} setPassword={setPassword} autoComplete="new-password" />
              <PasswordField password={confirmPassword} setPassword={setConfirmPassword} placeholder="Confirm password" autoComplete="new-password" />

              <div className="space-y-3 pt-1">
                <LegalCheckbox
                  id="accept-terms"
                  checked={acceptedTerms}
                  onChange={setAcceptedTerms}
                  linkLabel="Terms & Conditions"
                  onLinkClick={() => setLegalModal("terms")}
                />
                <LegalCheckbox
                  id="accept-privacy"
                  checked={acceptedPrivacy}
                  onChange={setAcceptedPrivacy}
                  linkLabel="Privacy Policy"
                  onLinkClick={() => setLegalModal("privacy")}
                />
              </div>

              {errorBlock}

              <Button
                type="submit"
                isLoading={isLoading}
                className="w-full py-5 rounded-2xl text-base shadow-xl"
                disabled={
                  !username ||
                  !gender ||
                  !ageRange ||
                  !zipCode ||
                  !country ||
                  !email ||
                  !password ||
                  !confirmPassword ||
                  !acceptedTerms ||
                  !acceptedPrivacy
                }
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
          PRHOMZ Inc • Terms of Design apply
        </p>
      </div>

      {legalModal && <TermsModal kind={legalModal} onClose={() => setLegalModal(null)} />}
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
}) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative group/input">
      <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-google-gray group-focus-within/input:text-google-blue transition-colors">
        <Lock size={22} />
      </div>
      <input
        type={visible ? "text" : "password"}
        required
        value={password}
        onChange={(e) => setPassword?.(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="w-full bg-google-bg border border-google-border rounded-2xl py-5 pl-16 pr-14 text-base focus:ring-2 focus:ring-google-blue focus:outline-none focus:border-google-blue transition-all text-google-dark placeholder-google-gray shadow-inner"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Hide password" : "Show password"}
        title={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 pr-6 flex items-center text-google-gray hover:text-google-blue transition-colors focus:outline-none"
      >
        {visible ? <EyeOff size={20} /> : <Eye size={20} />}
      </button>
    </div>
  );
};

const TextField: React.FC<{
  value: string;
  setValue: (v: string) => void;
  placeholder: string;
  icon: React.ReactNode;
  autoComplete?: string;
  maxLength?: number;
}> = ({ value, setValue, placeholder, icon, autoComplete, maxLength }) => (
  <div className="relative group/input">
    <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-google-gray group-focus-within/input:text-google-blue transition-colors">
      {icon}
    </div>
    <input
      type="text"
      required
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={placeholder}
      autoComplete={autoComplete}
      maxLength={maxLength}
      className="w-full bg-google-bg border border-google-border rounded-2xl py-5 pl-16 pr-6 text-base focus:ring-2 focus:ring-google-blue focus:outline-none focus:border-google-blue transition-all text-google-dark placeholder-google-gray shadow-inner"
    />
  </div>
);

const SelectField: React.FC<{
  value: string;
  setValue: (v: string) => void;
  placeholder: string;
  options: readonly string[];
}> = ({ value, setValue, placeholder, options }) => (
  <div className="relative group/input">
    <select
      required
      value={value}
      onChange={(e) => setValue(e.target.value)}
      className={`w-full appearance-none bg-google-bg border border-google-border rounded-2xl py-5 pl-5 pr-11 text-base focus:ring-2 focus:ring-google-blue focus:outline-none focus:border-google-blue transition-all shadow-inner ${
        value ? "text-google-dark" : "text-google-gray"
      }`}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map((opt) => (
        <option key={opt} value={opt} className="text-google-dark">
          {opt}
        </option>
      ))}
    </select>
    <div className="absolute inset-y-0 right-0 pr-5 flex items-center pointer-events-none text-google-gray">
      <ChevronDown size={20} />
    </div>
  </div>
);

// Searchable country field: type-to-filter combobox backed by the ISO list.
// Only a value present in COUNTRIES counts as selected (server re-validates).
const CountryField: React.FC<{ value: string; setValue: (v: string) => void }> = ({ value, setValue }) => {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<number | null>(null);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return COUNTRIES.slice(0, 60);
    return COUNTRIES.filter((c) => c.toLowerCase().includes(q)).slice(0, 60);
  }, [query]);

  // What the input shows: the confirmed selection, unless the user is actively typing.
  const display = open ? query : value;

  return (
    <div className="relative group/input">
      <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none text-google-gray group-focus-within/input:text-google-blue transition-colors">
        <Globe size={20} />
      </div>
      <input
        type="text"
        required
        value={display}
        placeholder="Country"
        autoComplete="off"
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (value) setValue("");
        }}
        onBlur={() => {
          // Delay so an option click registers before we close.
          blurTimer.current = window.setTimeout(() => setOpen(false), 150);
        }}
        className="w-full bg-google-bg border border-google-border rounded-2xl py-5 pr-4 text-base text-google-dark focus:ring-2 focus:ring-google-blue focus:outline-none focus:border-google-blue transition-all placeholder-google-gray shadow-inner"
        style={{ paddingLeft: "3.25rem" }}
      />
      {open && matches.length > 0 && (
        <ul className="absolute z-50 mt-2 w-full max-h-56 overflow-auto bg-google-surface border border-google-border rounded-2xl shadow-2xl py-2">
          {matches.map((c) => (
            <li key={c}>
              <button
                type="button"
                // onMouseDown fires before input blur, so the selection lands.
                onMouseDown={(e) => {
                  e.preventDefault();
                  setValue(c);
                  setQuery("");
                  setOpen(false);
                  if (blurTimer.current) window.clearTimeout(blurTimer.current);
                }}
                className={`w-full text-left px-5 py-2.5 text-sm hover:bg-google-blue/10 transition-colors ${
                  c === value ? "text-google-blue font-bold" : "text-google-dark"
                }`}
              >
                {c}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

interface LegalCheckboxProps {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  linkLabel: string;
  onLinkClick: () => void;
}

const LegalCheckbox: React.FC<LegalCheckboxProps> = ({ id, checked, onChange, linkLabel, onLinkClick }) => (
  <label htmlFor={id} className="flex items-start space-x-3 cursor-pointer select-none">
    <input
      id={id}
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-1 w-4 h-4 rounded border-google-border text-google-blue focus:ring-google-blue focus:ring-offset-0 cursor-pointer"
    />
    <span className="text-xs text-google-gray leading-snug">
      I agree to the{" "}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          onLinkClick();
        }}
        className="text-google-blue font-bold hover:underline focus:outline-none focus:underline"
      >
        {linkLabel}
      </button>
      .
    </span>
  </label>
);
