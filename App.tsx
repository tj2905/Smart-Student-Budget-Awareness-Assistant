
import React, { useState, useEffect, useMemo } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend 
} from 'recharts';
import { Expense, Category, Budget } from './types';
import { getAIInsights } from './services/geminiService';

const COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#64748b'];

const App: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem('expenses');
    return saved ? JSON.parse(saved) : [];
  });

  const [budget, setBudget] = useState<Budget>(() => {
    const saved = localStorage.getItem('budget');
    return saved ? JSON.parse(saved) : { monthlyLimit: 15000 };
  });

  const [aiInsight, setAiInsight] = useState<string>('');
  const [loadingInsight, setLoadingInsight] = useState(false);
  
  // Form State
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>(Category.FOOD);
  const [note, setNote] = useState('');

  useEffect(() => {
    localStorage.setItem('expenses', JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem('budget', JSON.stringify(budget));
  }, [budget]);

  const addExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount))) return;

    const newExpense: Expense = {
      id: crypto.randomUUID(),
      amount: Number(amount),
      category,
      note,
      timestamp: new Date().toISOString().split('T')[0]
    };

    setExpenses([newExpense, ...expenses]);
    setAmount('');
    setNote('');
  };

  const deleteExpense = (id: string) => {
    setExpenses(expenses.filter(e => e.id !== id));
  };

  const totalSpent = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);
  const remainingBudget = budget.monthlyLimit - totalSpent;
  const budgetPercent = Math.min((totalSpent / budget.monthlyLimit) * 100, 100);

  const chartData = useMemo(() => {
    const groups: Record<string, number> = {};
    Object.values(Category).forEach(cat => groups[cat] = 0);
    expenses.forEach(e => {
      groups[e.category] += e.amount;
    });
    return Object.keys(groups).map(key => ({ name: key, value: groups[key] })).filter(d => d.value > 0);
  }, [expenses]);

  const dailyData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();

    return last7Days.map(date => {
      const total = expenses
        .filter(e => e.timestamp === date)
        .reduce((sum, e) => sum + e.amount, 0);
      return { date: date.slice(5), amount: total };
    });
  }, [expenses]);

  const fetchInsights = async () => {
    setLoadingInsight(true);
    const insight = await getAIInsights(expenses, budget);
    setAiInsight(insight);
    setLoadingInsight(false);
  };

  const exportCSV = () => {
    const header = "Date,Category,Amount,Note\n";
    const rows = expenses.map(e => `${e.timestamp},${e.category},${e.amount},"${e.note}"`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      {/* Header */}
      <header className="bg-indigo-600 text-white p-6 shadow-lg mb-8 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-2 rounded-lg">
              <i className="fa-solid fa-graduation-cap text-2xl"></i>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">StudentSpend AI</h1>
              <p className="text-indigo-100 text-xs font-medium">Smart Finance for Smarter Students</p>
            </div>
          </div>
          <button 
            onClick={exportCSV}
            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-400 px-4 py-2 rounded-full text-sm font-semibold transition-all border border-indigo-400/30"
          >
            <i className="fa-solid fa-file-export"></i>
            Export CSV
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Sidebar Controls */}
        <aside className="lg:col-span-4 space-y-6">
          {/* Budget Setting Card */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <i className="fa-solid fa-wallet text-indigo-500"></i>
              Monthly Budget
            </h2>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-slate-400">₹</span>
              <input 
                type="number" 
                value={budget.monthlyLimit}
                onChange={(e) => setBudget({ monthlyLimit: Number(e.target.value) })}
                className="w-full pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-semibold"
                placeholder="Set limit"
              />
            </div>
            <div className="mt-6 space-y-2">
              <div className="flex justify-between text-sm font-medium">
                <span className="text-slate-500">Spent: <span className="text-slate-900">₹{totalSpent}</span></span>
                <span className="text-slate-500">Left: <span className={remainingBudget < 0 ? 'text-rose-500' : 'text-emerald-500'}>₹{remainingBudget}</span></span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${budgetPercent > 90 ? 'bg-rose-500' : 'bg-indigo-500'}`}
                  style={{ width: `${budgetPercent}%` }}
                />
              </div>
            </div>
          </div>

          {/* Add Expense Form */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
              <i className="fa-solid fa-plus-circle text-indigo-500"></i>
              Add Expense
            </h2>
            <form onSubmit={addExpense} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Amount (₹)</label>
                <input 
                  required
                  type="number" 
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Category</label>
                <select 
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {Object.values(Category).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Note (Optional)</label>
                <input 
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="What was this for?"
                />
              </div>
              <button 
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-200"
              >
                Log Expense
              </button>
            </form>
          </div>

          {/* AI Insights Card */}
          <div className="bg-gradient-to-br from-indigo-600 to-violet-700 p-6 rounded-2xl shadow-lg text-white">
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
              <i className="fa-solid fa-wand-magic-sparkles"></i>
              Smart Insights
            </h2>
            {aiInsight ? (
              <div className="text-sm bg-white/10 p-3 rounded-lg leading-relaxed whitespace-pre-line border border-white/20">
                {aiInsight}
              </div>
            ) : (
              <p className="text-sm text-indigo-100 mb-4 italic">Get personalized financial coaching based on your spending.</p>
            )}
            <button 
              onClick={fetchInsights}
              disabled={loadingInsight}
              className={`mt-4 w-full py-2 rounded-xl text-sm font-bold border transition-all ${loadingInsight ? 'bg-white/10 border-white/10 cursor-not-allowed' : 'bg-white text-indigo-600 hover:bg-indigo-50 border-white'}`}
            >
              {loadingInsight ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="fa-solid fa-spinner animate-spin"></i>
                  Analyzing...
                </span>
              ) : 'Generate Insights'}
            </button>
          </div>
        </aside>

        {/* Dashboard Main Area */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Charts Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-[350px]">
              <h3 className="text-slate-600 font-bold mb-4 flex items-center gap-2">
                <i className="fa-solid fa-chart-pie text-indigo-400"></i>
                Spending by Category
              </h3>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="85%">
                  <PieChart>
                    <Pie
                      data={chartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => `₹${value}`}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-sm">
                  No data to display
                </div>
              )}
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 h-[350px]">
              <h3 className="text-slate-600 font-bold mb-4 flex items-center gap-2">
                <i className="fa-solid fa-chart-line text-indigo-400"></i>
                Daily Trends (Last 7 Days)
              </h3>
              <ResponsiveContainer width="100%" height="85%">
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                  <Tooltip 
                    formatter={(value) => `₹${value}`}
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* History List */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="p-6 border-b border-slate-50 flex justify-between items-center">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <i className="fa-solid fa-receipt text-indigo-500"></i>
                Recent History
              </h2>
              <span className="text-xs font-medium px-2 py-1 bg-slate-100 text-slate-500 rounded-md">
                {expenses.length} Records
              </span>
            </div>
            <div className="overflow-x-auto">
              {expenses.length > 0 ? (
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3">Date</th>
                      <th className="px-6 py-3">Category</th>
                      <th className="px-6 py-3">Note</th>
                      <th className="px-6 py-3 text-right">Amount</th>
                      <th className="px-6 py-3 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {expenses.map(e => (
                      <tr key={e.id} className="hover:bg-slate-50/30 transition-colors group">
                        <td className="px-6 py-4 text-xs text-slate-500 whitespace-nowrap">{e.timestamp}</td>
                        <td className="px-6 py-4">
                          <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-bold border border-indigo-100">
                            {e.category}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-slate-600 truncate max-w-[150px]">{e.note || '-'}</td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-900 text-right">₹{e.amount.toFixed(2)}</td>
                        <td className="px-6 py-4 text-center">
                          <button 
                            onClick={() => deleteExpense(e.id)}
                            className="text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                          >
                            <i className="fa-solid fa-trash-can"></i>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-12 text-center text-slate-400">
                  <i className="fa-solid fa-box-open text-4xl mb-3 block opacity-20"></i>
                  <p>No transactions logged yet.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Mobile Sticky Add Button - Optional enhancement */}
      <footer className="fixed bottom-0 left-0 right-0 p-4 lg:hidden pointer-events-none">
        <div className="max-w-6xl mx-auto flex justify-end">
          <button 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="pointer-events-auto bg-indigo-600 text-white w-14 h-14 rounded-full shadow-2xl flex items-center justify-center text-xl hover:scale-110 transition-transform"
          >
            <i className="fa-solid fa-arrow-up"></i>
          </button>
        </div>
      </footer>
    </div>
  );
};

export default App;
