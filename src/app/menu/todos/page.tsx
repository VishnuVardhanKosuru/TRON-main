"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { IconChevronLeft, IconChevronDown, IconSearch, IconCheck, IconPlus, IconTrash, IconMenu } from "@tabler/icons-react";
import Link from "next/link";
import { useAuthContext } from "@/context/AuthContext";
import { collection, query, onSnapshot, doc, updateDoc, serverTimestamp, addDoc } from "@/lib/tron/firestore";
import { db } from "@/lib/local-db";

// --- Types ---
type Todo = {
  id: string;
  title: string;
  dueDate: Date | null;
  completedAt: Date | null;
  createdAt: Date;
};

export default function TodosPage() {
  const router = useRouter();
  const { user } = useAuthContext();
  
  // State
  const [todos, setTodos] = useState<Todo[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false);
  const [justCompletedIds, setJustCompletedIds] = useState<Set<string>>(new Set());
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newTodoTitle, setNewTodoTitle] = useState("");

  // Live subscription to the local store
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "users", user.uid, "todos"));
    const unsub = onSnapshot(q, (snap) => {
      const loaded: Todo[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          title: data.title || "",
          dueDate: data.dueDate?.toDate() || null,
          completedAt: data.completedAt?.toDate() || (data.status === "done" ? new Date() : null),
          createdAt: data.createdAt?.toDate() || new Date(),
        };
      });
      setTodos(loaded);
    });
    return () => unsub();
  }, [user]);

  // Derived state
  const activeTodos = todos.filter(t => !t.completedAt && !justCompletedIds.has(t.id));
  
  const filteredTodos = useMemo(() => {
    return todos.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [todos, searchQuery]);

  // Grouping
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 86400000 - 1);

  const groups = useMemo(() => {
    const overdue: Todo[] = [];
    const today: Todo[] = [];
    const upcoming: Todo[] = [];
    const noDate: Todo[] = [];
    const completed: Todo[] = [];

    filteredTodos.forEach(todo => {
      const isActuallyCompleted = todo.completedAt && !justCompletedIds.has(todo.id);
      
      if (isActuallyCompleted) {
        completed.push(todo);
        return;
      }

      if (todo.dueDate) {
        if (todo.dueDate < startOfToday) {
          overdue.push(todo);
        } else if (todo.dueDate <= endOfToday) {
          today.push(todo);
        } else {
          upcoming.push(todo);
        }
      } else {
        noDate.push(todo);
      }
    });

    upcoming.sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime());
    noDate.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    completed.sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime());

    return { overdue, today, upcoming, noDate, completed };
  }, [filteredTodos, startOfToday, endOfToday, justCompletedIds]);

  const handleToggle = async (id: string) => {
    if (!user) return;
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    const ref = doc(db, "users", user.uid, "todos", id);

    if (todo.completedAt) {
      await updateDoc(ref, {
        completedAt: null,
        status: "pending"
      });
    } else {
      setJustCompletedIds(prev => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });

      setTimeout(async () => {
        await updateDoc(ref, {
          completedAt: serverTimestamp(),
          status: "done"
        });
        setJustCompletedIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 550);
    }
  };

  const handleAddTodo = async () => {
    if (!user || !newTodoTitle.trim()) return;
    
    try {
      await addDoc(collection(db, "users", user.uid, "todos"), {
        title: newTodoTitle.trim(),
        dueDate: null,
        completedAt: null,
        createdAt: serverTimestamp(),
        status: "pending"
      });
      setNewTodoTitle("");
      setIsAddModalOpen(false);
    } catch (error) {
      console.error("Error adding todo:", error);
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const deleteTodo = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;
    
    try {
      const todo = todos.find(t => t.id === id);
      if (!todo) return;
      
      // Animate before deletion
      setJustCompletedIds(prev => {
        const next = new Set(prev);
        next.add(id);
        return next;
      });
      
      setTimeout(async () => {
        await updateDoc(doc(db, "users", user.uid, "todos", id), {
          completedAt: serverTimestamp(),
          status: "done"
        });
        setJustCompletedIds(prev => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 300);
    } catch (error) {
      console.error("Error deleting todo:", error);
    }
  };

  // --- Render Item ---
  const renderItem = (todo: Todo, dotColorClass: string, isDimmer = false) => {
    const isJustCompleted = justCompletedIds.has(todo.id);
    const isCompleted = !!todo.completedAt;
    
    let dotBorder = dotColorClass;
    let dotBg = "bg-[#18120a]";
    let textColor = "text-white/95";
    
    if (isCompleted || isJustCompleted) {
      dotBorder = "border-white/20";
      dotBg = "bg-white/10";
      textColor = "text-white/30 line-through";
    }

    return (
      <motion.div
        key={todo.id}
        layout="position"
        initial={{ opacity: 0, y: 10 }}
        animate={{ 
          opacity: (isCompleted && !isJustCompleted) ? 0.6 : (isJustCompleted ? 0.55 : 1), 
          y: 0 
        }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
        className="flex items-start gap-4 py-2 group cursor-pointer"
        onClick={() => {
          // Navigate to detail view
        }}
      >
        <div 
          onClick={(e) => { e.stopPropagation(); handleToggle(todo.id); }}
          className={`relative mt-[3px] shrink-0 w-[15px] h-[15px] rounded-full border-[1.5px] ${dotBorder} ${dotBg} flex items-center justify-center transition-all duration-300 z-10`}
          style={{ opacity: isDimmer && !isCompleted && !isJustCompleted ? 0.4 : 1 }}
        >
           <AnimatePresence>
             {(isCompleted || isJustCompleted) && (
               <motion.div
                 initial={{ scale: 0 }}
                 animate={{ scale: 1 }}
                 exit={{ scale: 0 }}
                 transition={{ duration: 0.2 }}
               >
                 <IconCheck size={10} stroke={3} className="text-white/80" />
               </motion.div>
             )}
           </AnimatePresence>
        </div>

        <div className="flex-1 flex justify-between items-start gap-3 pr-2">
          <span className={`text-[16px] font-medium leading-snug transition-all duration-500 ${textColor}`}>
            {todo.title}
          </span>
          {todo.dueDate && !isCompleted && !isJustCompleted && (
            <span className="text-[13px] text-white/40 whitespace-nowrap mt-[2px]">
              {formatDate(todo.dueDate)}
            </span>
          )}
          <button 
            onClick={(e) => deleteTodo(todo.id, e)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-white/20 hover:text-white/60"
          >
            <IconTrash size={14} />
          </button>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-[#05070d] text-white overflow-x-hidden selection:bg-sky-500/20">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-30%] w-[120vw] h-[120vw] bg-gradient-to-br from-sky-500/10 to-transparent rounded-full blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[-40%] w-[140vw] h-[140vw] bg-gradient-to-tr from-blue-900/10 to-transparent rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#05070d]/80 backdrop-blur-xl border-b border-white/5 pt-12 pb-4 px-5">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/menu?item=todos" className="w-10 h-10 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 active:bg-white/15 transition-all duration-200">
              <IconChevronLeft size={24} className="text-white/70" />
            </Link>
            <div>
              <h1 className="text-[22px] font-semibold tracking-tight text-white/95">Todos</h1>
              <div className="text-[11px] text-white/40 font-mono mt-0.5">
                {activeTodos.length} active · {todos.filter(t => !t.completedAt).length} pending
              </div>
            </div>
          </div>
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="relative w-10 h-10 flex items-center justify-center rounded-2xl bg-sky-500/15 hover:bg-sky-500/25 active:scale-95 transition-all duration-200 group"
          >
            <div className="absolute inset-0 rounded-2xl border border-sky-500/30 group-hover:border-sky-500/50 transition-all duration-200" />
            <IconPlus size={24} className="text-sky-500 group-hover:text-sky-400 transition-colors" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${(todos.filter(t => t.completedAt).length / todos.length) * 100 || 0}%` }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="h-full bg-gradient-to-r from-sky-500 to-sky-400 rounded-full"
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 px-5 pt-6 pb-32">
        {/* Glass Search */}
        <div className="relative mb-8">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <IconSearch size={18} className="text-white/30" />
          </div>
          <input
            type="text"
            placeholder="Search todos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full glass-input px-4 py-3 pl-12 text-[15px] text-white placeholder:text-white/30 focus:outline-none transition-all duration-200"
          />
        </div>

        {/* List Container */}
        {filteredTodos.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-16 text-center"
          >
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-white/5 flex items-center justify-center">
              <IconPlus size={28} className="text-white/20" />
            </div>
            <p className="text-[15px] text-white/40 mb-2">No todos yet</p>
            <p className="text-[13px] text-white/25">Tap the + button to add your first todo</p>
          </motion.div>
        ) : (
          <div className="relative">
            {/* The continuous vertical spine */}
            <div className="absolute top-2 bottom-6 left-[8px] w-[1px] bg-gradient-to-b from-white/10 via-sky-500/20 to-white/10 z-0" />
            
            <div className="flex flex-col gap-10 relative z-10">
              
              {/* Overdue */}
              {groups.overdue.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="flex flex-col gap-4"
                >
                  <h2 className="text-[11px] font-semibold tracking-widest uppercase text-red-500/80 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500/80 animate-pulse" />
                    Overdue
                  </h2>
                  <div className="flex flex-col gap-2">
                    <AnimatePresence mode="popLayout">
                      {groups.overdue.map(t => renderItem(t, "border-red-500/60", false))}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}

              {/* Today */}
              {groups.today.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="flex flex-col gap-4"
                >
                  <h2 className="text-[11px] font-semibold tracking-widest uppercase text-sky-500/80 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-500/80" />
                    Today
                  </h2>
                  <div className="flex flex-col gap-2">
                    <AnimatePresence mode="popLayout">
                      {groups.today.map(t => renderItem(t, "border-sky-500/60", false))}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}

              {/* Upcoming */}
              {groups.upcoming.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="flex flex-col gap-4"
                >
                  <h2 className="text-[11px] font-semibold tracking-widest uppercase text-white/50 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/30" />
                    Upcoming
                  </h2>
                  <div className="flex flex-col gap-2">
                    <AnimatePresence mode="popLayout">
                      {groups.upcoming.map(t => renderItem(t, "border-white/30", false))}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}

              {/* No Date */}
              {groups.noDate.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="flex flex-col gap-4"
                >
                  <h2 className="text-[11px] font-semibold tracking-widest uppercase text-white/40 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                    No Date
                  </h2>
                  <div className="flex flex-col gap-2">
                    <AnimatePresence mode="popLayout">
                      {groups.noDate.map(t => renderItem(t, "border-white/20", true))}
                    </AnimatePresence>
                  </div>
                </motion.div>
              )}

              {/* Completed */}
              {groups.completed.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="flex flex-col gap-4 mt-8"
                >
                  <div className="pl-8 relative">
                    <div className="absolute top-0 bottom-0 left-[-24px] w-[34px] bg-[#05070d] z-0" />
                    
                    <button 
                      onClick={() => setIsCompletedExpanded(!isCompletedExpanded)}
                      className="relative z-10 flex items-center gap-3 py-1 group"
                    >
                      <div className={`transition-transform duration-300 ${isCompletedExpanded ? 'rotate-180' : ''}`}>
                        <IconChevronDown size={18} className={`text-white/40 group-hover:text-white/60 transition-colors ${isCompletedExpanded ? 'text-white/60' : ''}`} />
                      </div>
                      <h2 className="text-[11px] font-semibold tracking-widest uppercase text-white/30 group-hover:text-white/50 transition-colors">
                        Completed ({groups.completed.length})
                      </h2>
                      <span className="text-white/20 text-[10px] font-mono">
                        {Math.round((groups.completed.length / filteredTodos.length) * 100)}%
                      </span>
                    </button>
                  </div>
                  
                  <AnimatePresence mode="popLayout">
                    {isCompletedExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="flex flex-col gap-2 pt-2 pb-6">
                          {groups.completed.map(t => renderItem(t, "border-white/15", true))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

            </div>
          </div>
        )}
      </main>

      {/* Add Todo Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setIsAddModalOpen(false)}
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 250 }}
              className="relative z-10 w-full max-w-lg mx-4 mb-safe-bottom"
            >
              <div className="glass-card-elevated p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[18px] font-semibold text-white/95">New Todo</h3>
                  <button 
                    onClick={() => setIsAddModalOpen(false)}
                    className="p-2 text-white/40 hover:text-white/60 transition-colors"
                  >
                    <IconChevronDown size={20} />
                  </button>
                </div>
                
                <input
                  type="text"
                  placeholder="What needs to be done?"
                  value={newTodoTitle}
                  onChange={(e) => setNewTodoTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
                  className="w-full glass-input px-4 py-3 text-[16px] text-white placeholder:text-white/30 focus:outline-none mb-4"
                  autoFocus
                />
                
                <div className="flex items-center justify-end gap-3">
                  <button 
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-5 py-2.5 rounded-xl text-[14px] font-medium text-white/60 hover:text-white/80 hover:bg-white/5 transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleAddTodo}
                    disabled={!newTodoTitle.trim()}
                    className="px-5 py-2.5 rounded-xl text-[14px] font-medium bg-gradient-to-r from-sky-500 to-sky-400 text-black hover:from-sky-400 hover:to-sky-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-sky-500/20 transition-all duration-200 active:scale-95"
                  >
                    Add Todo
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
