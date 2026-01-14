
import React, { useState } from 'react';
import { Mail, ArrowRight, ShieldCheck, Sparkles, Loader2 } from 'lucide-react';
import { Button } from './Button';
import { UserAccount } from '../types';

interface AuthProps {
  onLogin: (user: UserAccount) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [view, setView] = useState<'landing' | 'email'>('landing');

  const handleAuth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) return;

    setIsLoading(true);
    
    // Simulate API delay
    setTimeout(() => {
      const newUser: UserAccount = {
        id: `u-${Date.now()}`,
        name: email.split('@')[0],
        email: email,
        role: email.toLowerCase().includes('admin') ? 'Admin' : 'Client',
        lastActive: Date.now(),
        totalRenders: 0
      };
      
      localStorage.setItem('prhomz_user', JSON.stringify(newUser));
      onLogin(newUser);
      setIsLoading(false);
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-google-bg flex items-center justify-center overflow-hidden font-sans">
      {/* Background Decorative Elements */}
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
          <p className="text-google-gray text-sm font-bold uppercase tracking-[0.4em] opacity-80">Inspiring Homes, Enriching Lives</p>
        </div>

        <div className="bg-google-surface border border-google-border rounded-[3rem] p-10 md:p-14 shadow-2xl backdrop-blur-2xl relative overflow-hidden group">
          {view === 'landing' ? (
            <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-700">
              <div className="space-y-4">
                <h2 className="text-3xl font-bold text-google-dark leading-tight">Reimagine your world with Spatial Intelligence.</h2>
                <p className="text-base text-google-gray leading-relaxed">
                  Join the elite community of designers and homeowners using generative AI to curate and shop perfect living spaces.
                </p>
              </div>

              <div className="space-y-4">
                <Button 
                  onClick={() => setView('email')} 
                  className="w-full py-5 rounded-2xl group/btn text-base shadow-xl"
                >
                  Quick Create Account <ArrowRight size={20} className="ml-3 group-hover/btn:translate-x-2 transition-transform" />
                </Button>
                <button 
                  onClick={() => setView('email')}
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
          ) : (
            <form onSubmit={handleAuth} className="space-y-10 animate-in fade-in slide-in-from-right-6 duration-500">
              <div className="space-y-3">
                <h2 className="text-2xl font-bold text-google-dark">Access the Atelier</h2>
                <p className="text-sm text-google-gray">Enter your email for passwordless authentication.</p>
              </div>

              <div className="relative group/input">
                <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none text-google-gray group-focus-within/input:text-google-blue transition-colors">
                  <Mail size={22} />
                </div>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full bg-google-bg border border-google-border rounded-2xl py-5 pl-16 pr-8 text-base focus:ring-2 focus:ring-google-blue focus:outline-none focus:border-google-blue transition-all text-google-dark placeholder-google-gray shadow-inner"
                  autoFocus
                />
              </div>

              <Button 
                type="submit" 
                isLoading={isLoading}
                className="w-full py-5 rounded-2xl text-base shadow-xl"
                disabled={!email || !email.includes('@')}
              >
                {isLoading ? 'Authenticating Gateway...' : 'Continue to Studio'}
              </Button>

              <button 
                type="button"
                onClick={() => setView('landing')}
                className="w-full text-xs font-black uppercase tracking-[0.2em] text-google-gray hover:text-google-dark transition-colors"
              >
                Return to Onboarding
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
