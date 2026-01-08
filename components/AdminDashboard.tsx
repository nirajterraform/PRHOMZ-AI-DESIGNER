
import React, { useState, useEffect } from 'react';
import { Database, BarChart3, Users, RefreshCw, Activity, ShieldCheck, Mail, Calendar, ArrowUpRight, Package, Diamond, Globe, TrendingUp, Target, CreditCard, Layout } from 'lucide-react';
import { fetchShopifyProducts, fetchSystemAnalytics, fetchUserDirectory } from '../services/dataService';
import { ProductItem, AnalyticsSummary, UserAccount } from '../types';
import { Button } from './Button';

type AdminTab = 'overview' | 'inventory' | 'users' | 'revenue';

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
          <p className="text-google-gray text-sm font-medium uppercase tracking-widest mt-1">Systems Oversight & Intelligence</p>
        </div>
        <div className="flex bg-google-surface p-1 rounded-xl border border-google-border">
          {['overview', 'inventory', 'users', 'revenue'].map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab as AdminTab)} className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-google-blue text-google-bg shadow-lg' : 'text-google-gray hover:text-google-dark'}`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'overview' && analytics && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Total Iterations', value: analytics.totalDesigns, icon: Diamond, trend: '+12%' },
              { label: 'Artifact Matches', value: analytics.totalProductsSourced, icon: Package, trend: '+8%' },
              { label: 'Gross Potential', value: `$${(analytics.revenuePotential / 1000).toFixed(0)}K`, icon: Activity, trend: '+24%' },
              { label: 'Active Members', value: analytics.activeUsers, icon: Globe, trend: '+5%' }
            ].map((stat, i) => (
              <div key={i} className="bg-google-surface p-6 rounded-2xl border border-google-border shadow-sm group hover:border-google-blue transition-all">
                <div className="flex justify-between items-start mb-6">
                    <div className="p-3 bg-google-bg rounded-xl border border-google-border text-google-blue group-hover:bg-google-blue group-hover:text-google-bg transition-colors"><stat.icon size={20} /></div>
                    <div className="text-green-400 text-[10px] font-bold bg-green-400/10 px-2 py-0.5 rounded-full border border-green-400/20">{stat.trend}</div>
                </div>
                <p className="text-[10px] font-black text-google-gray uppercase tracking-widest mb-1">{stat.label}</p>
                <h3 className="text-2xl font-bold text-google-dark">{stat.value}</h3>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-google-surface rounded-2xl p-8 border border-google-border shadow-sm">
               <div className="flex justify-between items-center mb-8">
                  <h4 className="text-sm font-bold text-google-gray uppercase tracking-widest">Growth Velocity (30d)</h4>
                  <div className="flex space-x-2">
                     <span className="flex items-center text-[10px] font-bold text-google-blue uppercase"><TrendingUp size={12} className="mr-1"/> High Intensity</span>
                  </div>
               </div>
               <div className="h-64 flex items-end justify-between gap-2 px-2">
                  {[40, 60, 45, 90, 65, 85, 100, 75, 95, 120, 110, 140].map((h, i) => (
                    <div key={i} className="flex-1 bg-google-blue/10 rounded-t-lg group relative hover:bg-google-blue/30 transition-all cursor-pointer">
                       <div className="absolute bottom-0 left-0 right-0 bg-google-blue rounded-t-lg transition-all" style={{ height: `${h}%` }}></div>
                       <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 bg-google-dark text-google-bg text-[9px] font-bold px-2 py-1 rounded shadow-xl pointer-events-none">{h}k</div>
                    </div>
                  ))}
               </div>
               <div className="flex justify-between mt-4 text-[9px] font-bold text-google-gray uppercase tracking-widest">
                  <span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span>
               </div>
            </div>

            <div className="bg-google-surface rounded-2xl p-8 border border-google-border shadow-sm">
               <h4 className="text-sm font-bold text-google-gray uppercase tracking-widest mb-8">Conversion Funnel</h4>
               <div className="space-y-6">
                  {[
                    { label: 'Design Start', val: 100, color: 'bg-google-blue' },
                    { label: 'Shop the Look', val: 42, color: 'bg-indigo-400' },
                    { label: 'Cart Addition', val: 18, color: 'bg-purple-400' },
                    { label: 'Final Checkout', val: 4, color: 'bg-green-400' }
                  ].map((item, i) => (
                    <div key={i} className="space-y-2">
                       <div className="flex justify-between text-[10px] font-bold uppercase text-google-gray">
                          <span>{item.label}</span>
                          <span className="text-google-dark">{item.val}%</span>
                       </div>
                       <div className="h-1 bg-google-bg rounded-full overflow-hidden">
                          <div className={`h-full ${item.color}`} style={{ width: `${item.val}%` }}></div>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          </div>

          <div className="bg-google-surface rounded-2xl p-8 border border-google-border shadow-sm">
             <h4 className="text-sm font-bold text-google-gray uppercase tracking-widest mb-8">Member Tier Distribution Matrix</h4>
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

      {activeTab === 'revenue' && analytics && (
        <div className="space-y-8 animate-fade">
           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="bg-google-surface p-8 rounded-2xl border border-google-border shadow-sm flex flex-col justify-between">
                 <div className="space-y-4">
                    <div className="p-3 bg-google-bg rounded-xl border border-google-border text-google-blue w-fit"><Target size={20} /></div>
                    <h4 className="text-sm font-bold text-google-gray uppercase tracking-widest">Affiliate Revenue (EST)</h4>
                    <h3 className="text-4xl font-black text-google-dark">${(analytics.revenuePotential * 0.08).toLocaleString()}</h3>
                 </div>
                 <p className="text-[10px] text-google-gray mt-8 font-medium italic">Based on a 8% average commission across partner Shopify nodes.</p>
              </div>

              <div className="lg:col-span-2 bg-google-surface p-8 rounded-2xl border border-google-border shadow-sm">
                 <h4 className="text-sm font-bold text-google-gray uppercase tracking-widest mb-8">Top Affiliate Partners</h4>
                 <div className="space-y-4">
                    {[
                      { name: 'West Elm', rev: 45200, sales: 122 },
                      { name: 'Restoration Hardware', rev: 128000, sales: 42 },
                      { name: 'CB2', rev: 32100, sales: 88 },
                      { name: 'Anthropologie Home', rev: 12400, sales: 24 }
                    ].map((p, i) => (
                      <div key={i} className="flex items-center justify-between p-4 bg-google-bg rounded-xl border border-google-border hover:border-google-blue transition-colors group">
                         <div className="flex items-center space-x-4">
                            <div className="w-10 h-10 bg-google-surface rounded-lg flex items-center justify-center font-bold text-xs group-hover:text-google-blue">{p.name.charAt(0)}</div>
                            <div>
                               <p className="font-bold text-google-dark text-sm">{p.name}</p>
                               <p className="text-[10px] text-google-gray uppercase font-bold tracking-widest">{p.sales} Conversions</p>
                            </div>
                         </div>
                         <div className="text-right">
                            <p className="font-black text-google-dark text-sm">${p.rev.toLocaleString()}</p>
                            <p className="text-[9px] text-green-400 font-bold uppercase">+12%</p>
                         </div>
                      </div>
                    ))}
                 </div>
              </div>
           </div>

           <div className="bg-google-surface rounded-2xl p-8 border border-google-border shadow-sm">
              <div className="flex justify-between items-center mb-8">
                 <h4 className="text-sm font-bold text-google-gray uppercase tracking-widest">Subscription Revenue Matrix</h4>
                 <Layout size={18} className="text-google-gray" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                 {[
                   { label: 'Essential', price: 0, users: 450, color: 'text-neutral-400' },
                   { label: 'Signature', price: 29, users: 320, color: 'text-google-blue' },
                   { label: 'Premium', price: 59, users: 280, color: 'text-indigo-400' },
                   { label: 'Elite Pro', price: 99, users: 195, color: 'text-purple-400' }
                 ].map((tier, i) => (
                   <div key={i} className="p-6 bg-google-bg rounded-xl border border-google-border flex flex-col justify-between">
                      <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-4 ${tier.color}`}>{tier.label}</p>
                      <div>
                         <p className="text-xl font-black text-google-dark">${(tier.price * tier.users).toLocaleString()}</p>
                         <p className="text-[9px] text-google-gray uppercase font-bold tracking-widest">MRR Estimate</p>
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
              <h3 className="font-bold text-google-dark">Partner Feed Control</h3>
              <Button onClick={() => { setIsSyncing(true); setTimeout(() => setIsSyncing(false), 1000); }} isLoading={isSyncing} size="sm" className="rounded-full px-6 shadow-md"><RefreshCw size={14} className="mr-2" /> Full Catalog Sync</Button>
           </div>
           <table className="w-full text-left">
              <thead className="bg-google-bg/50 text-[10px] font-black text-google-gray uppercase tracking-widest border-b border-google-border">
                <tr><th className="px-6 py-4">Artifact</th><th className="px-6 py-4">Verification</th><th className="px-6 py-4">Price</th><th className="px-6 py-4">Stock</th><th className="px-6 py-4 text-right">Action</th></tr>
              </thead>
              <tbody className="divide-y divide-google-border/30">
                {inventory.map(item => (
                  <tr key={item.id} className="hover:bg-google-bg/30 transition-colors">
                    <td className="px-6 py-4"><p className="font-bold text-google-dark text-sm">{item.name}</p></td>
                    <td className="px-6 py-4"><span className="text-[10px] font-bold text-green-400 uppercase bg-green-400/5 px-2 py-0.5 rounded-full border border-green-400/20">Verified</span></td>
                    <td className="px-6 py-4 font-bold text-google-blue text-sm">${item.price.toLocaleString()}</td>
                    <td className="px-6 py-4 font-mono text-xs text-google-gray">{item.stockLevel} units</td>
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
            <div key={user.id} className="bg-google-surface p-8 rounded-2xl border border-google-border shadow-sm hover:border-google-blue transition-all group">
               <div className="flex justify-between items-center mb-6">
                  <div className="w-12 h-12 bg-google-bg rounded-xl flex items-center justify-center border border-google-border overflow-hidden"><img src={`https://api.dicebear.com/7.x/initials/svg?seed=${user.name}`} alt="" /></div>
                  <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${user.role === 'Admin' ? 'bg-google-blue text-google-bg border-google-blue' : 'bg-google-bg text-google-gray border-google-border'}`}>{user.role}</span>
               </div>
               <h4 className="font-bold text-google-dark text-lg mb-1 group-hover:text-google-blue transition-colors">{user.name}</h4>
               <p className="text-google-gray text-xs truncate mb-6">{user.email}</p>
               <div className="pt-4 border-t border-google-border flex justify-between items-center">
                  <div className="flex flex-col">
                     <span className="text-[9px] font-black text-google-gray uppercase tracking-widest">Total Renders</span>
                     <span className="text-sm font-bold text-google-dark">{user.totalRenders}</span>
                  </div>
                  <button className="text-[9px] font-black text-google-gray hover:text-red-400 uppercase transition-all flex items-center"><ShieldCheck size={10} className="mr-1"/> Restrict</button>
               </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
