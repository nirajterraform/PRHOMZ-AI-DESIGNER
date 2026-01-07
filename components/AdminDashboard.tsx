
import React, { useState, useEffect } from 'react';
import { Database, BarChart3, Users, RefreshCw, Activity, ShieldCheck, Mail, Calendar, ArrowUpRight, Package, Diamond, Globe } from 'lucide-react';
import { fetchShopifyProducts, syncToFirestore, fetchSystemAnalytics, fetchUserDirectory } from '../services/dataService';
import { ProductItem, AnalyticsSummary, UserAccount } from '../types';
import { Button } from './Button';

type AdminTab = 'overview' | 'inventory' | 'users';

export const AdminDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [inventory, setInventory] = useState<ProductItem[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [stats, products, accounts] = await Promise.all([fetchSystemAnalytics(), fetchShopifyProducts(), fetchUserDirectory()]);
      setAnalytics(stats); setInventory(products); setUsers(accounts);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  if (loading) return (
    <div className="h-[60vh] flex flex-col items-center justify-center space-y-4 animate-fade">
      <div className="w-12 h-12 border-4 border-google-border border-t-google-blue rounded-full animate-spin"></div>
      <p className="text-lg font-medium text-google-dark">Retrieving Atelier metrics...</p>
    </div>
  );

  return (
    <div className="space-y-12 animate-fade">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-3xl font-bold text-google-dark">Atelier Console</h2>
          <p className="text-google-gray text-sm font-medium uppercase tracking-widest mt-1">Systems Oversight</p>
        </div>
        <div className="flex bg-google-surface p-1 rounded-xl border border-google-border">
          {['overview', 'inventory', 'users'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab as AdminTab)} className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-google-blue text-google-bg shadow-lg' : 'text-google-gray hover:text-google-dark'}`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && analytics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'Iterations', value: analytics.totalDesigns, icon: Diamond },
            { label: 'Artifacts', value: analytics.totalProductsSourced, icon: Package },
            { label: 'Valuation', value: `$${analytics.revenuePotential.toLocaleString()}`, icon: Activity },
            { label: 'Members', value: analytics.activeUsers, icon: Globe }
          ].map((stat, i) => (
            <div key={i} className="bg-google-surface p-6 rounded-2xl border border-google-border shadow-sm group hover:border-google-blue transition-all">
               <div className="flex justify-between items-start mb-6">
                  <div className="p-3 bg-google-bg rounded-xl border border-google-border text-google-blue"><stat.icon size={20} /></div>
                  <div className="text-green-400 text-[10px] font-bold bg-green-400/10 px-2 py-0.5 rounded-full border border-green-400/20">Live</div>
               </div>
               <p className="text-[10px] font-black text-google-gray uppercase tracking-widest mb-1">{stat.label}</p>
               <h3 className="text-2xl font-bold text-google-dark">{stat.value}</h3>
            </div>
          ))}
          <div className="lg:col-span-4 bg-google-surface rounded-2xl p-8 border border-google-border shadow-sm">
             <h4 className="text-sm font-bold text-google-gray uppercase tracking-widest mb-8">Tier Distribution Matrix</h4>
             <div className="grid grid-cols-1 sm:grid-cols-4 gap-8">
                {Object.entries(analytics.usageByTier).map(([tier, count]) => (
                   <div key={tier} className="space-y-4">
                      <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-google-gray"><span>{tier}</span><span>{count as number}</span></div>
                      <div className="h-1.5 bg-google-bg rounded-full border border-google-border overflow-hidden">
                         <div className="h-full bg-google-blue" style={{ width: `${((count as number) / (analytics.totalDesigns || 1)) * 100}%` }}></div>
                      </div>
                   </div>
                ))}
             </div>
          </div>
        </div>
      )}

      {activeTab === 'inventory' && (
        <div className="bg-google-surface rounded-2xl overflow-hidden border border-google-border shadow-lg">
           <div className="p-6 border-b border-google-border flex justify-between items-center bg-google-bg/30">
              <h3 className="font-bold text-google-dark">Partner Feed</h3>
              <Button onClick={() => { setIsSyncing(true); setTimeout(() => setIsSyncing(false), 1000); }} isLoading={isSyncing} size="sm" className="rounded-full px-6 shadow-md"><RefreshCw size={14} className="mr-2" /> Sync Feed</Button>
           </div>
           <table className="w-full text-left">
              <thead className="bg-google-bg/50 text-[10px] font-black text-google-gray uppercase tracking-widest border-b border-google-border">
                <tr><th className="px-6 py-4">Artifact</th><th className="px-6 py-4">Verification</th><th className="px-6 py-4">Price</th><th className="px-6 py-4 text-right">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-google-border/30">
                {inventory.map(item => (
                  <tr key={item.id} className="hover:bg-google-bg/30 transition-colors">
                    <td className="px-6 py-4"><p className="font-bold text-google-dark text-sm">{item.name}</p></td>
                    <td className="px-6 py-4"><span className="text-[10px] font-bold text-green-400 uppercase bg-green-400/5 px-2 py-0.5 rounded-full border border-green-400/20">Verified</span></td>
                    <td className="px-6 py-4 font-bold text-google-blue text-sm">${item.price.toLocaleString()}</td>
                    <td className="px-6 py-4 text-right"><button className="p-2 text-google-gray hover:text-google-blue transition-all"><ArrowUpRight size={18} /></button></td>
                  </tr>
                ))}
              </tbody>
           </table>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {users.map(user => (
            <div key={user.id} className="bg-google-surface p-8 rounded-2xl border border-google-border shadow-sm hover:border-google-blue transition-all">
               <div className="flex justify-between items-center mb-6">
                  <div className="w-12 h-12 bg-google-bg rounded-xl flex items-center justify-center border border-google-border overflow-hidden"><img src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`} alt="" /></div>
                  <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${user.role === 'Admin' ? 'bg-google-blue text-google-bg border-google-blue' : 'bg-google-bg text-google-gray border-google-border'}`}>{user.role}</span>
               </div>
               <h4 className="font-bold text-google-dark text-lg mb-1">{user.name}</h4>
               <p className="text-google-gray text-xs truncate mb-6">{user.email}</p>
               <div className="pt-4 border-t border-google-border flex justify-between items-center">
                  <span className="text-[9px] font-black text-google-gray uppercase tracking-widest">Renders: {user.totalRenders}</span>
                  <button className="text-[9px] font-black text-google-blue uppercase hover:underline">Revoke</button>
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
