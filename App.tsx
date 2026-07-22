import React, { useState, useEffect } from 'react';
import { Navigation } from './components/Navigation';
import { Remodeler } from './components/Remodeler';
import { Assistant } from './components/Assistant';
import { Gallery } from './components/Gallery';
import { Pricing } from './components/Pricing';
import { AdminDashboard } from './components/AdminDashboard';
import { Auth } from './components/Auth';
import { EmailVerificationPending } from './components/EmailVerificationPending';
import { MockCheckout } from './components/MockCheckout';
import { MockPortal } from './components/MockPortal';
import { UpgradeSuccess } from './components/UpgradeSuccess';
import { GeoProvider } from './contexts/GeoContext';
import { AppMode, GeneratedImage, UserAccount, ProductItem } from './types';
import { Search, HelpCircle, Settings, Grid, X, Loader2, ShoppingCart, LogOut, Crown, AlertTriangle, CalendarClock, MessageSquare, Trash2 } from 'lucide-react';
import { FeedbackModal } from './components/FeedbackModal';
import { DeleteAccountModal } from './components/DeleteAccountModal';
import { searchCatalog } from './services/geminiService';
import { onAuthChange, signOut } from './services/authService';
import { subscribeToUser } from './services/userService';
import { subscribeToGallery } from './services/galleryService';
import { createCustomerPortalSession } from './services/stripeService';
import type { User as FirebaseUser } from 'firebase/auth';

function App() {
  // Dev-only mock-checkout / mock-portal routes (Phase 4 Track A). Guarded by
  // import.meta.env.DEV so production bundles can never render these pages.
  if (import.meta.env.DEV) {
    if (window.location.pathname === '/__mock-checkout') return <MockCheckout />;
    if (window.location.pathname === '/__mock-portal') return <MockPortal />;
  }
  return <MainApp />;
}

function MainApp() {
  const [authUser, setAuthUser] = useState<FirebaseUser | null | undefined>(undefined);
  const [userDoc, setUserDoc] = useState<UserAccount | null>(null);

  const [currentMode, setCurrentMode] = useState<AppMode>(AppMode.REMODEL);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [activeEditImage, setActiveEditImage] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<ProductItem[] | null>(null);

  // Phase 4 Day 3: detect post-checkout redirect from Stripe / MockCheckout and
  // surface the UpgradeSuccess screen. We capture the param once on mount so
  // that a later soft state change won't accidentally re-trigger it.
  const [showUpgradeSuccess, setShowUpgradeSuccess] = useState<boolean>(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get('upgrade') === 'success';
  });

  // Loading state for the profile-dropdown "Manage Subscription" click while
  // the portal-session callable resolves.
  const [isOpeningPortal, setIsOpeningPortal] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);

  // Subscribe to Firebase auth state
  useEffect(() => {
    return onAuthChange((user) => {
      setAuthUser(user);
      if (!user) {
        setUserDoc(null);
      } else if (user.emailVerified) {
        // Force-refresh the ID token once for a verified user so the backend
        // sees email_verified=true. Right after verifying, the restored/cached
        // token can still carry the stale false claim.
        user.getIdToken(true).catch(() => {
          // ignore transient refresh errors
        });
      }
    });
  }, []);

  // Phase 3 Day 1: the user doc is created by the `onUserCreate` Cloud Function
  // (Auth trigger). Client just subscribes; the snapshot will arrive once the
  // Function finishes (usually <500ms after Auth signup).
  useEffect(() => {
    if (!authUser || !authUser.emailVerified) return;
    const unsubscribe = subscribeToUser(authUser.uid, setUserDoc);
    return () => unsubscribe();
  }, [authUser]);

  // Safety net: if a still-valid session somehow lands on a soft-deleted user
  // doc, sign out immediately. (Normal flow signs out inside deleteAccount();
  // this catches the edge case of a delete happening on another device.)
  useEffect(() => {
    if (userDoc?.deletedAt) {
      signOut();
    }
  }, [userDoc?.deletedAt]);

  // Gallery now subscribes to Firestore (Phase 2). LocalStorage is no longer read or written.
  const [isGalleryLoading, setIsGalleryLoading] = useState(true);
  useEffect(() => {
    if (!authUser || !authUser.emailVerified) {
      setGeneratedImages([]);
      setIsGalleryLoading(false);
      return;
    }
    setIsGalleryLoading(true);
    const unsubscribe = subscribeToGallery(authUser.uid, (images) => {
      setGeneratedImages(images);
      setIsGalleryLoading(false);
    });
    return () => unsubscribe();
  }, [authUser]);

  // Scroll-reactive header (mirrors the landing site's shrinking/frosting nav).
  // Different views scroll in their own nested containers, so we listen in the
  // CAPTURE phase to catch scroll from any descendant scroller, then read its
  // scrollTop. This makes the header react no matter which panel is scrolling.
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  useEffect(() => {
    const onScrollCapture = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target && typeof target.scrollTop === "number") {
        setIsHeaderScrolled(target.scrollTop > 40);
      }
    };
    window.addEventListener("scroll", onScrollCapture, true);
    return () => window.removeEventListener("scroll", onScrollCapture, true);
  }, []);

  const handleLogout = async () => {
    setIsProfileOpen(false);
    setGeneratedImages([]);
    await signOut();
  };

  const handleManageSubscription = async () => {
    setIsProfileOpen(false);
    if (!userDoc) return;
    // Freemium has no Stripe subscription yet — route them to Pricing instead.
    if (userDoc.tier === 'freemium') {
      setCurrentMode(AppMode.PRICING);
      return;
    }
    setIsOpeningPortal(true);
    setPortalError(null);
    try {
      const url = await createCustomerPortalSession();
      window.location.href = url;
    } catch (e) {
      setPortalError((e as { message?: string })?.message || 'Failed to open customer portal.');
      setIsOpeningPortal(false);
    }
  };

  const dismissUpgradeSuccess = () => {
    setShowUpgradeSuccess(false);
    // Strip the `?upgrade=success` query string so a refresh doesn't re-trigger
    // the success page.
    window.history.replaceState({}, '', window.location.pathname);
  };

  const handleImageGenerated = (_image: GeneratedImage) => {
    // Image is already persisted to Firestore by the proxy* Cloud Functions,
    // which also increment quota counters atomically. The user subscription
    // will surface the new doc and updated counters.
  };

  const handleEditFromGallery = (imageUrl: string) => {
    setActiveEditImage(imageUrl);
    setCurrentMode(AppMode.REMODEL);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await searchCatalog(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error('Search failed', error);
    } finally {
      setIsSearching(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
  };

  const renderContent = () => {
    switch (currentMode) {
      case AppMode.REMODEL:
        return (
          <Remodeler
            onImageGenerated={handleImageGenerated}
            initialImage={activeEditImage}
            onClearInitial={() => setActiveEditImage(null)}
            currentUser={userDoc}
            onNavigateToPricing={() => setCurrentMode(AppMode.PRICING)}
          />
        );
      case AppMode.ASSISTANT:
        return <Assistant />;
      case AppMode.GALLERY:
        return (
          <Gallery
            images={generatedImages}
            onEdit={handleEditFromGallery}
            tier={userDoc?.tier ?? 'freemium'}
            isLoading={isGalleryLoading}
            onNavigateToPricing={() => setCurrentMode(AppMode.PRICING)}
          />
        );
      case AppMode.PRICING:
        return (
          <Pricing
            currentTier={userDoc?.tier ?? 'freemium'}
            subscriptionStatus={userDoc?.subscriptionStatus ?? null}
          />
        );
      case AppMode.ADMIN:
        return <AdminDashboard />;
      default:
        return (
          <Remodeler
            onImageGenerated={handleImageGenerated}
            currentUser={userDoc}
            onNavigateToPricing={() => setCurrentMode(AppMode.PRICING)}
          />
        );
    }
  };

  // Render hierarchy
  if (authUser === undefined) {
    return <FullPageSpinner label="Loading..." />;
  }
  if (authUser === null) {
    return <Auth />;
  }
  if (!authUser.emailVerified) {
    return <EmailVerificationPending email={authUser.email || ''} />;
  }
  if (!userDoc) {
    return <FullPageSpinner label="Preparing your studio..." />;
  }

  // Post-checkout landing — swap the whole app for the UpgradeSuccess card
  // until the user dismisses or navigates. The component itself handles the
  // race between Stripe redirect and webhook delivery.
  if (showUpgradeSuccess) {
    return (
      <UpgradeSuccess
        user={userDoc}
        onStartDesigning={() => {
          dismissUpgradeSuccess();
          setCurrentMode(AppMode.REMODEL);
        }}
        onGoToGallery={() => {
          dismissUpgradeSuccess();
          setCurrentMode(AppMode.GALLERY);
        }}
        onDismiss={dismissUpgradeSuccess}
      />
    );
  }

  const showPastDueBanner = userDoc.subscriptionStatus === 'past_due';
  const showCanceledBanner =
    userDoc.subscriptionStatus === 'canceled' &&
    typeof userDoc.currentPeriodEnd === 'number' &&
    userDoc.currentPeriodEnd > Date.now();

  return (
    <GeoProvider>
    <div className="min-h-screen bg-google-bg text-google-dark font-sans flex flex-col md:flex-row">
      <Navigation
        currentMode={currentMode}
        onModeChange={(mode) => {
          setCurrentMode(mode);
          if (mode === AppMode.REMODEL) setActiveEditImage(null);
        }}
        isOpen={isNavOpen}
        setIsOpen={setIsNavOpen}
        userRole={userDoc.role}
      />

      <main className="flex-1 flex flex-col overflow-hidden relative">
        <header className={`relative flex items-center justify-between px-6 md:px-10 border-b backdrop-blur-xl sticky top-0 z-30 transition-all duration-300 ${
          isHeaderScrolled
            ? 'h-16 bg-google-bg/80 border-google-blue/30 shadow-lg shadow-black/20'
            : 'h-20 bg-google-bg/95 border-google-border'
        }`}>
          {/* Luminous accent line at the bottom (mirrors the landing header) */}
          <div className={`absolute bottom-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-google-blue/60 to-transparent transition-opacity duration-300 ${isHeaderScrolled ? 'opacity-100' : 'opacity-0'}`} />
          <div className="flex items-center flex-1">
            <div className="md:hidden flex flex-col ml-12">
              <h1 className="text-lg font-serif italic tracking-tighter text-google-dark leading-none">
                PRHOMZ <span className="text-google-blue not-italic font-sans font-black">AI</span>
              </h1>
            </div>

            <form
              onSubmit={handleSearch}
              className="hidden md:flex flex-1 max-w-xl bg-google-surface rounded-2xl px-5 py-2.5 items-center border border-google-border shadow-inner focus-within:border-google-blue/50 transition-all relative"
            >
              <Search size={16} className="text-google-gray mr-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search PRHOMZ Catalog for furniture..."
                className="bg-transparent border-none focus:outline-none text-sm w-full text-google-dark placeholder-google-gray font-medium"
              />
              {isSearching && <Loader2 size={16} className="animate-spin text-google-blue absolute right-4" />}
              {!isSearching && searchQuery && (
                <button type="button" onClick={clearSearch} className="text-google-gray hover:text-google-dark absolute right-4">
                  <X size={16} />
                </button>
              )}
            </form>
          </div>

          <div className="flex items-center space-x-3 ml-4">
            <div className="hidden lg:flex items-center space-x-1 mr-4">
              <button className="p-2.5 text-google-gray hover:bg-google-surface hover:text-google-dark rounded-xl transition-all">
                <HelpCircle size={18} />
              </button>
              <button className="p-2.5 text-google-gray hover:bg-google-surface hover:text-google-dark rounded-xl transition-all">
                <Settings size={18} />
              </button>
              <button className="p-2.5 text-google-gray hover:bg-google-surface hover:text-google-dark rounded-xl transition-all">
                <Grid size={18} />
              </button>
            </div>

            <div
              className="relative pl-6 border-l border-google-border flex items-center space-x-3 group cursor-pointer"
              onClick={() => setIsProfileOpen(!isProfileOpen)}
            >
              <div className="hidden sm:flex flex-col items-end text-right gap-1">
                <span className="text-[10px] font-bold text-google-dark uppercase tracking-wider leading-none">{userDoc.name}</span>
                <span className="text-[9px] font-bold text-google-blue uppercase tracking-widest leading-none">{userDoc.tier}</span>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-google-blue text-google-bg flex items-center justify-center text-sm font-black shadow-lg shadow-google-blue/20 transition-transform group-hover:scale-105">
                {userDoc.name.charAt(0).toUpperCase()}
              </div>

              {isProfileOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-google-surface border border-google-border rounded-2xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-200">
                  <div className="px-4 py-3 border-b border-google-border mb-1">
                    <p className="text-[10px] font-bold text-google-gray uppercase tracking-widest truncate">{userDoc.email}</p>
                    <p className="text-[9px] font-bold text-google-blue uppercase tracking-widest mt-1">{userDoc.tier} tier</p>
                  </div>
                  <button
                    onClick={handleManageSubscription}
                    disabled={isOpeningPortal}
                    className="w-full flex items-center space-x-3 px-4 py-3 text-sm font-semibold text-google-dark hover:bg-google-bg rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {isOpeningPortal ? (
                      <Loader2 size={16} className="text-google-blue animate-spin" />
                    ) : (
                      <Crown size={16} className="text-google-blue" />
                    )}
                    <span>
                      {isOpeningPortal
                        ? 'Opening…'
                        : userDoc.tier === 'freemium'
                          ? 'Upgrade Membership'
                          : 'Manage Subscription'}
                    </span>
                  </button>
                  {portalError && (
                    <p className="px-4 py-2 text-[10px] text-red-400 leading-snug">{portalError}</p>
                  )}
                  <button
                    onClick={() => { setIsProfileOpen(false); setIsFeedbackOpen(true); }}
                    className="w-full flex items-center space-x-3 px-4 py-3 text-sm font-semibold text-google-dark hover:bg-google-bg rounded-xl transition-colors"
                  >
                    <MessageSquare size={16} className="text-google-blue" />
                    <span>Send feedback</span>
                  </button>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-3 px-4 py-3 text-sm font-semibold text-red-400 hover:bg-red-400/10 rounded-xl transition-colors"
                  >
                    <LogOut size={16} />
                    <span>Logout</span>
                  </button>
                  <div className="border-t border-google-border my-1" />
                  <button
                    onClick={() => { setIsProfileOpen(false); setIsDeleteAccountOpen(true); }}
                    className="w-full flex items-center space-x-3 px-4 py-3 text-sm font-semibold text-red-400 hover:bg-red-400/10 rounded-xl transition-colors"
                  >
                    <Trash2 size={16} />
                    <span>Delete my account</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {showPastDueBanner && (
          <div className="bg-orange-400/10 border-b border-orange-400/30 px-6 md:px-10 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-3 text-orange-400">
              <AlertTriangle size={16} />
              <p className="text-xs font-bold uppercase tracking-widest">
                Payment past due — update your card to keep your {userDoc.tier} benefits.
              </p>
            </div>
            <button
              onClick={handleManageSubscription}
              disabled={isOpeningPortal}
              className="text-[10px] font-bold uppercase tracking-widest text-orange-400 hover:text-google-dark transition-colors disabled:opacity-60"
            >
              {isOpeningPortal ? 'Opening…' : 'Update payment'}
            </button>
          </div>
        )}

        {showCanceledBanner && (
          <div className="bg-google-surface border-b border-google-border px-6 md:px-10 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-3 text-google-gray">
              <CalendarClock size={16} />
              <p className="text-xs font-bold uppercase tracking-widest">
                Subscription ending {new Date(userDoc.currentPeriodEnd ?? 0).toLocaleDateString()} —
                renew anytime.
              </p>
            </div>
            <button
              onClick={handleManageSubscription}
              disabled={isOpeningPortal}
              className="text-[10px] font-bold uppercase tracking-widest text-google-blue hover:text-google-dark transition-colors disabled:opacity-60"
            >
              {isOpeningPortal ? 'Opening…' : 'Manage plan'}
            </button>
          </div>
        )}

        {searchResults && (
          <div className="fixed inset-0 top-20 z-40 bg-google-bg/95 backdrop-blur-md overflow-y-auto animate-fade">
            <div className="max-w-6xl mx-auto p-8 md:p-12">
              <div className="flex justify-between items-end mb-12">
                <div>
                  <h2 className="text-3xl font-bold text-google-dark">Catalog Results</h2>
                  <p className="text-google-gray text-xs font-bold uppercase tracking-widest mt-2">
                    Showing matches for "{searchQuery}"
                  </p>
                </div>
                <button
                  onClick={clearSearch}
                  className="px-6 py-2.5 rounded-full border border-google-border text-[10px] font-bold uppercase tracking-widest hover:bg-google-surface transition-all flex items-center"
                >
                  <X size={14} className="mr-2" /> Close Results
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {searchResults.map((item) => (
                  <div
                    key={item.id}
                    className="group bg-google-surface rounded-2xl border border-google-border overflow-hidden hover:border-google-blue transition-all shadow-sm flex flex-col"
                  >
                    <div className="aspect-square bg-google-bg relative overflow-hidden">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = `https://placehold.co/400x400/1e1e1e/8ab4f8?text=${encodeURIComponent(item.name)}`;
                        }}
                      />
                      <div className="absolute top-4 right-4">
                        <span className="bg-google-blue/90 text-google-bg px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                          ${item.price.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="p-6 flex-1 flex flex-col justify-between">
                      <div className="space-y-2 mb-6">
                        <h4 className="font-bold text-google-dark text-lg leading-tight">{item.name}</h4>
                        <p className="text-xs text-google-gray leading-relaxed line-clamp-3">{item.description}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <a
                          href={item.productUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 bg-google-blue text-google-bg py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:brightness-110 transition-all flex items-center justify-center"
                        >
                          <ShoppingCart size={14} className="mr-2" /> View on Store
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {searchResults.length === 0 && (
                <div className="py-20 text-center opacity-40">
                  <Search size={48} className="mx-auto mb-4" />
                  <p className="text-sm font-bold uppercase tracking-widest">No matching artifacts found in catalog</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-6 md:p-12 lg:p-16 custom-scrollbar">{renderContent()}</div>
      </main>

      {isFeedbackOpen && userDoc && (
        <FeedbackModal user={userDoc} onClose={() => setIsFeedbackOpen(false)} />
      )}

      {isDeleteAccountOpen && userDoc && (
        <DeleteAccountModal
          user={userDoc}
          galleryCount={generatedImages.length}
          onClose={() => setIsDeleteAccountOpen(false)}
          onDeleted={() => {
            setIsDeleteAccountOpen(false);
            // authService.deleteAccount() already calls signOut() — the auth
            // listener will route the app back to the landing screen.
          }}
        />
      )}
    </div>
    </GeoProvider>
  );
}

const FullPageSpinner: React.FC<{ label?: string }> = ({ label }) => (
  <div className="min-h-screen bg-google-bg flex flex-col items-center justify-center text-google-dark">
    <Loader2 size={32} className="animate-spin text-google-blue mb-4" />
    {label && <p className="text-xs font-bold uppercase tracking-[0.3em] text-google-gray">{label}</p>}
  </div>
);

export default App;
