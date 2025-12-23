
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend 
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { Expense, Category, Budget, Theme, CLILine, FilterState } from './types';
import { getAIInsights } from './services/geminiService';

const COLORS = ['#6366f1', '#f43f5e', '#10b981', '#f59e0b', '#8b5cf6', '#64748b', '#ec4899', '#06b6d4'];

const App: React.FC = () => {
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem('expenses');
    return saved ? JSON.parse(saved) : [];
  });

  const [budget, setBudget] = useState<Budget>(() => {
    const saved = localStorage.getItem('budget');
    return saved ? JSON.parse(saved) : { monthlyLimit: 15000 };
  });

  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('app-theme') as Theme) || Theme.LIGHT;
  });

  const [filters, setFilters] = useState<FilterState>({ query: '', category: 'All' });
  const [aiInsight, setAiInsight] = useState<string>('');
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [showCLI, setShowCLI] = useState(false);
  const [cliLines, setCliLines] = useState<CLILine[]>([{ text: 'StudentSpend Shell v3.0. Type "help" to start.', type: 'output' }]);
  const [cliInput, setCliInput] = useState('');
  
  // Form State
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<Category>(Category.FOOD);
  const [customCategory, setCustomCategory] = useState('');
  const [note, setNote] = useState('');

  const cliEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('expenses', JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem('budget', JSON.stringify(budget));
  }, [budget]);

  useEffect(() => {
    localStorage.setItem('app-theme', theme);
    const root = window.document.documentElement;
    root.classList.remove('dark', 'violet');
    if (theme === Theme.DARK) root.classList.add('dark');
    if (theme === Theme.VIOLET) root.classList.add('violet');
    if (theme === Theme.SYSTEM) {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (isDark) root.classList.add('dark');
    }
  }, [theme]);

  useEffect(() => {
    cliEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [cliLines]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCLI(prev => !prev);
      }
      if (e.key === 'Escape') setShowCLI(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const addExpense = (e?: React.FormEvent, cliData?: Partial<Expense>) => {
    e?.preventDefault();
    const finalAmt = cliData?.amount || Number(amount);
    if (!finalAmt || isNaN(finalAmt)) return;

    const finalCat = cliData?.category || (category === Category.OTHER ? (customCategory || 'Other') : category);

    const newExpense: Expense = {
      id: crypto.randomUUID(),
      amount: finalAmt,
      category: finalCat,
      note: cliData?.note || note,
      timestamp: new Date().toISOString().split('T')[0]
    };

    setExpenses(prev => [newExpense, ...prev]);
    if (!cliData) {
      setAmount('');
      setNote('');
      setCustomCategory('');
    }
  };

  const deleteExpense = (id: string) => {
    setExpenses(expenses.filter(e => e.id !== id));
  };

  const handleCLICommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cliInput.trim()) return;
    const cmd = cliInput.trim().toLowerCase();
    const parts = cmd.split(' ');
    const action = parts[0];
    const newLines: CLILine[] = [...cliLines, { text: `> ${cliInput}`, type: 'input' }];

    switch (action) {
      case 'add':
        const amt = parseFloat(parts[1]);
        if (isNaN(amt)) {
          newLines.push({ text: 'Error: usage "add 200 [cat_idx] [note]"', type: 'error' });
        } else {
          const catIdx = parseInt(parts[2]);
          const cats = Object.values(Category);
          const c = cats[catIdx] || Category.OTHER;
          const n = parts.slice(3).join(' ') || 'CLI Entry';
          addExpense(undefined, { amount: amt, category: c, note: n });
          newLines.push({ text: `Success: Logged ₹${amt}`, type: 'success' });
        }
        break;
      case 'budget':
        const bl = parseFloat(parts[1]);
        if (!isNaN(bl)) {
          setBudget({ monthlyLimit: bl });
          newLines.push({ text: `Budget updated to ₹${bl}`, type: 'success' });
        }
        break;
      case 'clear': setCliLines([]); setCliInput(''); return;
      case 'help':
        newLines.push({ text: 'Commands: add, budget, list, insight, clear', type: 'output' });
        break;
      default: newLines.push({ text: `Unknown: ${action}`, type: 'error' });
    }
    setCliLines(newLines);
    setCliInput('');
  };

  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchesQuery = (e.note || '').toLowerCase().includes(filters.query.toLowerCase()) || 
                          e.category.toLowerCase().includes(filters.query.toLowerCase());
      const matchesCat = filters.category === 'All' || e.category === filters.category;
      return matchesQuery && matchesCat;
    });
  }, [expenses, filters]);

  const totalSpent = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);
  const remainingBudget = budget.monthlyLimit - totalSpent;
  const budgetPercent = Math.min((totalSpent / budget.monthlyLimit) * 100, 100);

  const chartData = useMemo(() => {
    const groups: Record<string, number> = {};
    expenses.forEach(e => {
      groups[e.category] = (groups[e.category] || 0) + e.amount;
    });
    return Object.keys(groups).map(key => ({ name: key, value: groups[key] }));
  }, [expenses]);

  const dailyData = useMemo(() => {
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toISOString().split('T')[0];
    }).reverse();
    return last7Days.map(date => ({
      date: date.slice(5),
      amount: expenses.filter(e => e.timestamp === date).reduce((s, x) => s + x.amount, 0)
    }));
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
    a.download = `student_budget_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-slate-100 transition-colors duration-300 selection:bg-indigo-500 selection:text-white`}>
      {/* CLI Overlay */}
      <AnimatePresence>
        {showCLI && (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setShowCLI(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-2xl h-[450px] cli-gradient rounded-3xl shadow-[0_0_50px_rgba(79,70,229,0.3)] border border-slate-700/50 flex flex-col overflow-hidden"
            >
              <div className="bg-slate-800/60 px-6 py-3 flex items-center justify-between border-b border-slate-700/30">
                <span className="text-[10px] mono text-slate-400 font-bold uppercase tracking-widest">StudentSpend_Core_Interface_v3.0</span>
                <button onClick={() => setShowCLI(false)} className="text-slate-500 hover:text-white transition-colors"><i className="fa-solid fa-xmark"></i></button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 mono text-sm space-y-2">
                {cliLines.map((line, i) => (
                  <div key={i} className={line.type === 'error' ? 'text-rose-400' : line.type === 'success' ? 'text-emerald-400' : line.type === 'input' ? 'text-indigo-400' : 'text-slate-300'}>
                    {line.text}
                  </div>
                ))}
                <div ref={cliEndRef} />
              </div>
              <form onSubmit={handleCLICommand} className="p-4 bg-slate-900/40 border-t border-slate-700/30 flex items-center gap-3">
                <span className="text-indigo-500 mono font-bold animate-pulse">λ</span>
                <input autoFocus type="text" value={cliInput} onChange={e => setCliInput(e.target.value)} className="bg-transparent border-none outline-none flex-1 text-emerald-400 mono text-sm" placeholder="Ready for command..." />
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="sticky top-0 z-40 glass dark:bg-slate-950/80 shadow-sm mb-8 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.div whileHover={{ rotate: 15 }} className="bg-indigo-600 p-2.5 rounded-2xl shadow-xl shadow-indigo-500/20">
              <i className="fa-solid fa-graduation-cap text-white text-2xl"></i>
            </motion.div>
            <h1 className="text-2xl font-black tracking-tighter bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">StudentSpend AI</h1>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden lg:flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-800">
              {(['light', 'dark', 'violet'] as Theme[]).map(t => (
                <button key={t} onClick={() => setTheme(t)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${theme === t ? 'bg-white dark:bg-slate-800 shadow-md text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}>
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
            <button onClick={() => setShowCLI(true)} className="flex items-center gap-3 bg-slate-950 dark:bg-slate-100 text-white dark:text-slate-950 px-5 py-2.5 rounded-2xl font-bold text-xs hover:scale-105 transition-all shadow-lg">
              <span className="mono opacity-50">⌘K</span> TERMINAL
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-10 pb-24">
        
        {/* Left Col: Setup */}
        <div className="lg:col-span-4 space-y-8">
          
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl">
            <div className="flex justify-between items-start mb-8">
              <div>
                <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Monthly Budget Limit</p>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-indigo-600">₹</span>
                  <input type="number" value={budget.monthlyLimit} onChange={e => setBudget({ monthlyLimit: Number(e.target.value) })} className="bg-transparent w-full border-none focus:ring-0 text-3xl font-black placeholder:text-slate-200" />
                </div>
              </div>
              <div className="p-4 bg-indigo-50 dark:bg-indigo-500/10 rounded-3xl text-indigo-600">
                <i className="fa-solid fa-vault text-2xl"></i>
              </div>
            </div>
            <div className="space-y-6">
              <div className="flex justify-between items-end">
                <span className="text-sm font-bold text-slate-500">Net Efficiency</span>
                <span className={`text-lg font-black ${budgetPercent > 90 ? 'text-rose-500' : 'text-emerald-500'}`}>{100 - Math.round(budgetPercent)}%</span>
              </div>
              <div className="relative h-6 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden p-1">
                <motion.div initial={{ width: 0 }} animate={{ width: `${budgetPercent}%` }} transition={{ duration: 1.2, ease: "circOut" }} className={`h-full rounded-full relative ${budgetPercent > 90 ? 'bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)]' : 'bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]'}`}>
                  <div className="absolute inset-0 bg-white/20 animate-pulse-soft rounded-full"></div>
                </motion.div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Spent</span>
                  <span className="text-sm font-black">₹{totalSpent.toLocaleString()}</span>
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800">
                  <span className="block text-[10px] font-bold text-slate-400 mb-1 uppercase">Surplus</span>
                  <span className={`text-sm font-black ${remainingBudget < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>₹{remainingBudget.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-slate-900/40 p-8 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-xl">
            <h2 className="text-xl font-black mb-8 flex items-center gap-4"><span className="p-3 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl text-emerald-600"><i className="fa-solid fa-plus"></i></span>New Entry</h2>
            <form onSubmit={addExpense} className="space-y-6">
              <div className="relative group">
                <label className="absolute -top-2.5 left-4 bg-white dark:bg-slate-900 px-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest z-10 group-focus-within:text-indigo-600">Amount (₹)</label>
                <input required type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} className="w-full px-6 py-4 bg-transparent border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:border-indigo-500 outline-none font-bold text-lg transition-all" placeholder="0.00" />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 ml-1">Select Category</label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.values(Category).map(cat => (
                    <button key={cat} type="button" onClick={() => setCategory(cat)} className={`px-4 py-3 rounded-2xl text-[11px] font-bold border-2 transition-all ${category === cat ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none' : 'bg-transparent border-slate-100 dark:border-slate-800 text-slate-500 hover:border-indigo-200'}`}>{cat}</button>
                  ))}
                </div>
              </div>
              <AnimatePresence>
                {category === Category.OTHER && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                    <input required type="text" value={customCategory} onChange={e => setCustomCategory(e.target.value)} className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-indigo-500 rounded-2xl outline-none font-bold text-sm transition-all" placeholder="What's the category name?" />
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="relative group">
                <label className="absolute -top-2.5 left-4 bg-white dark:bg-slate-900 px-2 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest z-10 group-focus-within:text-indigo-600">Note / Reason</label>
                <input type="text" value={note} onChange={e => setNote(e.target.value)} className="w-full px-6 py-4 bg-transparent border-2 border-slate-100 dark:border-slate-800 rounded-2xl focus:border-indigo-500 outline-none font-bold text-sm transition-all" placeholder="Optional context..." />
              </div>
              <motion.button whileTap={{ scale: 0.95 }} type="submit" className="w-full bg-slate-950 dark:bg-indigo-600 hover:bg-slate-800 dark:hover:bg-indigo-500 text-white font-black py-5 rounded-[2rem] transition-all shadow-2xl shadow-indigo-900/20 flex items-center justify-center gap-4">Log Transaction <i className="fa-solid fa-arrow-right"></i></motion.button>
            </form>
          </motion.div>

          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="bg-gradient-to-br from-indigo-700 via-violet-800 to-indigo-950 p-10 rounded-[3rem] shadow-2xl text-white relative overflow-hidden">
            <div className="absolute -top-10 -right-10 opacity-10 rotate-12 scale-150 pointer-events-none"><i className="fa-solid fa-brain text-[12rem]"></i></div>
            <h2 className="text-2xl font-black mb-6 flex items-center gap-4"><i className="fa-solid fa-bolt-lightning text-amber-400"></i>AI Mentor</h2>
            {aiInsight ? (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-sm font-medium leading-relaxed bg-white/10 backdrop-blur-xl p-6 rounded-[2rem] border border-white/20 shadow-2xl max-h-[250px] overflow-y-auto custom-scrollbar">
                <p className="whitespace-pre-line">{aiInsight}</p>
              </motion.div>
            ) : (
              <p className="text-indigo-100 text-sm mb-8 opacity-70 italic font-medium">Ready to decode your spending habits? Let Gemini find your biggest saving opportunities.</p>
            )}
            <button onClick={fetchInsights} disabled={loadingInsight} className={`mt-8 w-full py-5 rounded-[2rem] text-sm font-black transition-all flex items-center justify-center gap-4 ${loadingInsight ? 'bg-white/10 text-white/40 cursor-not-allowed' : 'bg-white text-indigo-900 hover:scale-105 shadow-xl active:scale-95'}`}>
              {loadingInsight ? <><i className="fa-solid fa-spinner-third animate-spin"></i>Processing...</> : <><i className="fa-solid fa-wand-magic-sparkles"></i>Run Diagnosis</>}
            </button>
          </motion.div>
        </div>

        {/* Right Col: Reports */}
        <div className="lg:col-span-8 space-y-10">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="bg-white dark:bg-slate-900/40 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl h-[450px] group">
              <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-10 flex items-center justify-between">Allocation Strategy <i className="fa-solid fa-circle-info opacity-30 group-hover:opacity-100 transition-opacity"></i></h3>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="80%">
                  <PieChart>
                    <Pie data={chartData} cx="50%" cy="50%" innerRadius={90} outerRadius={120} paddingAngle={8} dataKey="value" animationDuration={2000} animationBegin={200}>
                      {chartData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.1)', padding: '20px', backgroundColor: 'rgba(255,255,255,0.95)' }} />
                    <Legend iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              ) : <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4 opacity-50"><i className="fa-solid fa-chart-area text-6xl"></i><p className="text-xs font-bold uppercase tracking-widest">Awaiting Data</p></div>}
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }} className="bg-white dark:bg-slate-900/40 p-10 rounded-[3rem] border border-slate-100 dark:border-slate-800 shadow-xl h-[450px] group">
              <h3 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-10 flex items-center justify-between">Velocity Trend <i className="fa-solid fa-timeline opacity-30 group-hover:opacity-100 transition-opacity"></i></h3>
              <ResponsiveContainer width="100%" height="80%">
                <BarChart data={dailyData}>
                  <defs><linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366f1" /><stop offset="100%" stopColor="#8b5cf6" /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} strokeOpacity={0.05} />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 900 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 900 }} />
                  <Tooltip cursor={{ fill: 'rgba(99,102,241,0.05)' }} contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }} />
                  <Bar dataKey="amount" fill="url(#barGrad)" radius={[10, 10, 10, 10]} barSize={24} animationDuration={1500} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          </div>

          {/* Table & Filters */}
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="bg-white dark:bg-slate-900/40 rounded-[3.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden">
            <div className="p-10 border-b border-slate-50 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-8">
              <div className="flex items-center gap-6 w-full md:w-auto">
                <h2 className="text-2xl font-black">History</h2>
                <div className="flex items-center bg-slate-50 dark:bg-slate-800/50 px-5 py-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 w-full md:w-64">
                  <i className="fa-solid fa-magnifying-glass text-slate-400 mr-3 text-xs"></i>
                  <input type="text" placeholder="Search entries..." value={filters.query} onChange={e => setFilters({...filters, query: e.target.value})} className="bg-transparent border-none outline-none text-xs font-bold w-full" />
                </div>
              </div>
              <div className="flex items-center gap-4 w-full md:w-auto">
                <select value={filters.category} onChange={e => setFilters({...filters, category: e.target.value})} className="bg-slate-50 dark:bg-slate-800/50 px-5 py-2.5 rounded-2xl border border-slate-100 dark:border-slate-800 text-[11px] font-black outline-none focus:ring-2 focus:ring-indigo-500 w-full md:w-auto">
                  <option value="All">All Categories</option>
                  {Array.from(new Set(expenses.map(ex => ex.category))).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <button onClick={exportCSV} className="p-3 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-600 hover:text-white rounded-2xl transition-all"><i className="fa-solid fa-file-csv"></i></button>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] bg-slate-50/50 dark:bg-slate-950/20">
                  <tr>
                    <th className="px-10 py-6">Transaction</th>
                    <th className="px-10 py-6">Label</th>
                    <th className="px-10 py-6">Timeline</th>
                    <th className="px-10 py-6 text-right">Volume</th>
                    <th className="px-10 py-6"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800/30">
                  <AnimatePresence mode="popLayout">
                    {filteredExpenses.map((e, idx) => (
                      <motion.tr key={e.id} layout initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.3, delay: Math.min(idx * 0.05, 0.5) }} className="group hover:bg-indigo-50/30 dark:hover:bg-indigo-500/5 transition-colors">
                        <td className="px-10 py-8">
                          <div className="flex flex-col">
                            <span className="text-sm font-black text-slate-800 dark:text-slate-100">{e.note || 'General Expense'}</span>
                            <span className="text-[9px] mono text-slate-400 font-bold uppercase tracking-widest mt-1">TX-{e.id.slice(0, 8)}</span>
                          </div>
                        </td>
                        <td className="px-10 py-8">
                          <span className="inline-flex items-center px-4 py-1.5 rounded-xl text-[9px] font-black bg-white dark:bg-slate-800 text-indigo-600 border border-slate-100 dark:border-slate-700 shadow-sm uppercase tracking-wider">
                            {e.category}
                          </span>
                        </td>
                        <td className="px-10 py-8"><span className="text-xs text-slate-400 font-black">{e.timestamp}</span></td>
                        <td className="px-10 py-8 text-right"><span className="text-sm font-black text-slate-950 dark:text-white">₹{e.amount.toLocaleString()}</span></td>
                        <td className="px-10 py-8 text-right">
                          <button onClick={() => deleteExpense(e.id)} className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-300 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"><i className="fa-solid fa-trash-can"></i></button>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
              {filteredExpenses.length === 0 && (
                <div className="p-24 text-center">
                  <div className="w-24 h-24 bg-slate-50 dark:bg-slate-900 rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 shadow-inner"><i className="fa-solid fa-layer-group text-slate-300 text-3xl"></i></div>
                  <h4 className="text-slate-900 dark:text-white font-black mb-2 text-xl tracking-tight">Nothing Found</h4>
                  <p className="text-slate-400 text-sm max-w-xs mx-auto font-medium italic">Adjust your search or filters to see archived records.</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </main>

      <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-30">
        <motion.div initial={{ y: 100 }} animate={{ y: 0 }} className="bg-slate-950 dark:bg-white text-white dark:text-slate-950 px-10 py-4 rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.3)] flex items-center gap-10 border border-white/10">
          <div className="flex flex-col">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Today's Flow</span>
            <span className="text-lg font-black tracking-tighter">₹{dailyData[dailyData.length - 1]?.amount || 0}</span>
          </div>
          <div className="h-10 w-px bg-slate-800 dark:bg-slate-200"></div>
          <button onClick={() => setShowCLI(true)} className="flex items-center gap-3 font-black text-[11px] group">
            <i className="fa-solid fa-terminal text-indigo-500 group-hover:animate-pulse"></i>
            OPEN CONSOLE
          </button>
        </motion.div>
      </div>
    </div>
  );
};

export default App;
