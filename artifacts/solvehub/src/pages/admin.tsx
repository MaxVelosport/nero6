import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Users, BarChart3, Wallet, Search, RefreshCw,
  ShieldCheck, ShieldOff, ChevronLeft, ChevronRight,
  TrendingUp, CheckCircle2, Zap, Tag, Plus, Trash2,
  ArrowUpCircle, ArrowDownCircle, BookOpen, MessageSquare,
  FileText, Image, GraduationCap, X, ExternalLink,
  Activity, AlertTriangle, Clock, DollarSign,
  ListChecks, RotateCw, Undo2, Send, Settings as SettingsIcon,
  Heart, Mail, Timer, PowerOff, Eye, Crown, Megaphone,
  Edit, RotateCcw,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

const BASE_URL = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

function authHeaders() {
  const token = localStorage.getItem("authToken");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

type Tab = "overview" | "users" | "tasks" | "sessions" | "payments" | "transactions" | "promo" | "broadcast" | "health" | "settings" | "pricing";

interface AdminStats {
  users: { total: number; today: number };
  tasks: { total: number; completed: number; pending: number };
  sessions: { total: number; active: number };
  revenue: { total: number };
}

interface AdminUser {
  id: string; name: string; email: string; balance: number;
  isAdmin: boolean; emailVerified: boolean; educationLevel: string;
  createdAt: string; tasksCount: number; sessionsCount: number;
}

interface Transaction {
  id: number; userId: string; type: string; amount: number;
  description: string; createdAt: string; userName?: string; userEmail?: string;
}

interface AiTool { tool: string; count: number; cost: number; completed: number; }

interface UserDetail {
  user: AdminUser & { institution?: string; specialty?: string };
  transactions: Transaction[];
  recentTasks: { id: number; title: string; subject: string; status: string; actual_cost?: number; created_at: string }[];
}

const TX_TYPE_LABELS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  topup: { label: "Пополнение", color: "text-green-400 bg-green-400/10", icon: ArrowUpCircle },
  payment: { label: "Списание", color: "text-red-400 bg-red-400/10", icon: ArrowDownCircle },
  deduction: { label: "Корректировка", color: "text-orange-400 bg-orange-400/10", icon: ArrowDownCircle },
  bonus: { label: "Бонус", color: "text-blue-400 bg-blue-400/10", icon: ArrowUpCircle },
  refund: { label: "Возврат", color: "text-violet-400 bg-violet-400/10", icon: ArrowUpCircle },
};

const TOOL_ICONS: Record<string, React.ElementType> = {
  "Задачи": CheckCircle2,
  "Чат-сессии": MessageSquare,
  "Билеты": GraduationCap,
  "Конспекты": BookOpen,
  "Курсовые": FileText,
  "Иллюстрации": Image,
};

export default function AdminPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const [forbidden, setForbidden] = useState(false);

  // Overview
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [aiStats, setAiStats] = useState<{ tools: AiTool[]; daily: any[]; totalRevenue30d: number } | null>(null);

  // Users
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersTotal, setUsersTotal] = useState(0);
  const [usersPage, setUsersPage] = useState(1);
  const [usersSearch, setUsersSearch] = useState("");
  const [usersSearchInput, setUsersSearchInput] = useState("");
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);

  // Balance adjustment
  const [adjustUserId, setAdjustUserId] = useState<string | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustLoading, setAdjustLoading] = useState(false);

  // Transactions
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [txTotal, setTxTotal] = useState(0);
  const [txPage, setTxPage] = useState(1);
  const [txType, setTxType] = useState("");
  const [txLoading, setTxLoading] = useState(false);

  // Promo
  const [promos, setPromos] = useState<any[]>([]);
  const [promoLoading, setPromoLoading] = useState(false);
  const [newPromo, setNewPromo] = useState({ code: "", amount: "", max_uses: "100", description: "", expires_at: "" });
  const [creatingPromo, setCreatingPromo] = useState(false);
  const [promoFilter, setPromoFilter] = useState<"all" | "active" | "inactive">("all");
  const [editPromo, setEditPromo] = useState<any | null>(null);
  const [savingPromo, setSavingPromo] = useState(false);
  const [promoDetail, setPromoDetail] = useState<any | null>(null);
  const [promoDetailLoading, setPromoDetailLoading] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkData, setBulkData] = useState({ count: "10", prefix: "", length: "8", amount: "100", max_uses: "1", description: "", expires_at: "" });
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkResult, setBulkResult] = useState<any | null>(null);

  // Tasks (admin)
  const [adminTasks, setAdminTasks] = useState<any[]>([]);
  const [adminTasksTotal, setAdminTasksTotal] = useState(0);
  const [adminTasksPage, setAdminTasksPage] = useState(1);
  const [adminTasksStatus, setAdminTasksStatus] = useState("");
  const [adminTasksSearch, setAdminTasksSearch] = useState("");
  const [adminTasksSearchInput, setAdminTasksSearchInput] = useState("");
  const [adminTasksLoading, setAdminTasksLoading] = useState(false);
  const [taskActionId, setTaskActionId] = useState<number | null>(null);

  // Sessions (admin)
  const [adminSessions, setAdminSessions] = useState<any[]>([]);
  const [adminSessionsTotal, setAdminSessionsTotal] = useState(0);
  const [adminSessionsPage, setAdminSessionsPage] = useState(1);
  const [adminSessionsStatus, setAdminSessionsStatus] = useState("");
  const [adminSessionsLoading, setAdminSessionsLoading] = useState(false);

  // Payments
  const [adminPayments, setAdminPayments] = useState<any[]>([]);
  const [adminPaymentsTotal, setAdminPaymentsTotal] = useState(0);
  const [adminPaymentsPage, setAdminPaymentsPage] = useState(1);
  const [adminPaymentsLoading, setAdminPaymentsLoading] = useState(false);
  const [paymentSyncId, setPaymentSyncId] = useState<string | null>(null);
  const [paymentSyncResult, setPaymentSyncResult] = useState<any>(null);

  // Health
  const [health, setHealth] = useState<any>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [recentFailed, setRecentFailed] = useState<any[]>([]);

  // Broadcast
  const [bcAudience, setBcAudience] = useState("all");
  const [bcSubject, setBcSubject] = useState("");
  const [bcBody, setBcBody] = useState("");
  const [bcPreview, setBcPreview] = useState<number | null>(null);
  const [bcSending, setBcSending] = useState(false);

  // Settings
  const [settings, setSettings] = useState<any>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Top users
  const [topUsers, setTopUsers] = useState<any[]>([]);

  const LIMIT = 20;
  const TX_LIMIT = 30;

  const fetchStats = useCallback(async () => {
    const r = await fetch(`${BASE_URL}/api/admin/stats`, { headers: authHeaders() });
    if (r.status === 403) { setForbidden(true); return; }
    if (r.ok) setStats(await r.json());
  }, []);

  const fetchAiStats = useCallback(async () => {
    const r = await fetch(`${BASE_URL}/api/admin/ai-stats`, { headers: authHeaders() });
    if (r.ok) setAiStats(await r.json());
  }, []);

  const fetchUsers = useCallback(async () => {
    setUsersLoading(true);
    try {
      const params = new URLSearchParams({ page: String(usersPage), limit: String(LIMIT), search: usersSearch });
      const r = await fetch(`${BASE_URL}/api/admin/users?${params}`, { headers: authHeaders() });
      if (r.status === 403) { setForbidden(true); return; }
      if (r.ok) { const d = await r.json(); setUsers(d.users); setUsersTotal(d.total); }
    } finally { setUsersLoading(false); }
  }, [usersPage, usersSearch]);

  const fetchTransactions = useCallback(async () => {
    setTxLoading(true);
    try {
      const params = new URLSearchParams({ page: String(txPage), limit: String(TX_LIMIT), ...(txType ? { type: txType } : {}) });
      const r = await fetch(`${BASE_URL}/api/admin/transactions?${params}`, { headers: authHeaders() });
      if (r.ok) { const d = await r.json(); setTransactions(d.transactions); setTxTotal(d.total); }
    } finally { setTxLoading(false); }
  }, [txPage, txType]);

  const fetchPromos = useCallback(async () => {
    setPromoLoading(true);
    const r = await fetch(`${BASE_URL}/api/admin/promo`, { headers: authHeaders() });
    if (r.ok) setPromos(await r.json());
    setPromoLoading(false);
  }, []);

  // ── extended fetchers ──
  const fetchAdminTasks = useCallback(async () => {
    setAdminTasksLoading(true);
    try {
      const params = new URLSearchParams({ page: String(adminTasksPage), limit: "30", ...(adminTasksStatus ? { status: adminTasksStatus } : {}), ...(adminTasksSearch ? { search: adminTasksSearch } : {}) });
      const r = await fetch(`${BASE_URL}/api/admin/tasks?${params}`, { headers: authHeaders() });
      if (r.ok) { const d = await r.json(); setAdminTasks(d.tasks); setAdminTasksTotal(d.total); }
    } finally { setAdminTasksLoading(false); }
  }, [adminTasksPage, adminTasksStatus, adminTasksSearch]);

  const fetchAdminSessions = useCallback(async () => {
    setAdminSessionsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(adminSessionsPage), limit: "30", ...(adminSessionsStatus ? { status: adminSessionsStatus } : {}) });
      const r = await fetch(`${BASE_URL}/api/admin/sessions?${params}`, { headers: authHeaders() });
      if (r.ok) { const d = await r.json(); setAdminSessions(d.sessions); setAdminSessionsTotal(d.total); }
    } finally { setAdminSessionsLoading(false); }
  }, [adminSessionsPage, adminSessionsStatus]);

  const fetchAdminPayments = useCallback(async () => {
    setAdminPaymentsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(adminPaymentsPage), limit: "30" });
      const r = await fetch(`${BASE_URL}/api/admin/payments?${params}`, { headers: authHeaders() });
      if (r.ok) { const d = await r.json(); setAdminPayments(d.payments); setAdminPaymentsTotal(d.total); }
    } finally { setAdminPaymentsLoading(false); }
  }, [adminPaymentsPage]);

  const fetchHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const [h, f] = await Promise.all([
        fetch(`${BASE_URL}/api/admin/health`, { headers: authHeaders() }).then(r => r.json()),
        fetch(`${BASE_URL}/api/admin/recent-failed-tasks`, { headers: authHeaders() }).then(r => r.json()),
      ]);
      setHealth(h); setRecentFailed(Array.isArray(f) ? f : []);
    } finally { setHealthLoading(false); }
  }, []);

  const fetchSettings = useCallback(async () => {
    const r = await fetch(`${BASE_URL}/api/admin/settings`, { headers: authHeaders() });
    if (r.ok) setSettings(await r.json());
  }, []);

  const fetchTopUsers = useCallback(async () => {
    const r = await fetch(`${BASE_URL}/api/admin/top-users`, { headers: authHeaders() });
    if (r.ok) setTopUsers(await r.json());
  }, []);

  useEffect(() => { fetchStats(); fetchAiStats(); fetchTopUsers(); }, []);
  useEffect(() => { if (tab === "users") fetchUsers(); }, [tab, usersPage, usersSearch]);
  useEffect(() => { if (tab === "transactions") fetchTransactions(); }, [tab, txPage, txType]);
  useEffect(() => { if (tab === "promo" && promos.length === 0) fetchPromos(); }, [tab]);
  useEffect(() => { if (tab === "tasks") fetchAdminTasks(); }, [tab, adminTasksPage, adminTasksStatus, adminTasksSearch]);
  useEffect(() => { if (tab === "sessions") fetchAdminSessions(); }, [tab, adminSessionsPage, adminSessionsStatus]);
  useEffect(() => { if (tab === "payments") fetchAdminPayments(); }, [tab, adminPaymentsPage]);
  useEffect(() => { if (tab === "health" && !health) fetchHealth(); }, [tab]);
  useEffect(() => { if (tab === "settings" && !settings) fetchSettings(); }, [tab]);
  useEffect(() => { if (tab === "pricing" && !settings) fetchSettings(); }, [tab]);

  // ── extended actions ──
  async function handleRetryTask(id: number) {
    setTaskActionId(id);
    try {
      const r = await fetch(`${BASE_URL}/api/admin/tasks/${id}/retry`, { method: "POST", headers: authHeaders() });
      const d = await r.json();
      toast({ title: r.ok ? d.message || "Повтор запущен" : d.message || "Ошибка", variant: r.ok ? "default" : "destructive" });
      if (r.ok) fetchAdminTasks();
    } finally { setTaskActionId(null); }
  }

  async function handleRefundTask(id: number) {
    if (!confirm(`Вернуть деньги за задачу #${id}?`)) return;
    setTaskActionId(id);
    try {
      const r = await fetch(`${BASE_URL}/api/admin/tasks/${id}/refund`, { method: "POST", headers: authHeaders() });
      const d = await r.json();
      toast({ title: r.ok ? d.message : d.message || "Ошибка", variant: r.ok ? "default" : "destructive" });
      if (r.ok) fetchAdminTasks();
    } finally { setTaskActionId(null); }
  }

  async function handleExtendSession(id: string) {
    const hoursStr = prompt("Продлить на сколько часов?", "1");
    if (!hoursStr) return;
    const hours = parseInt(hoursStr);
    const r = await fetch(`${BASE_URL}/api/admin/sessions/${id}/extend`, {
      method: "POST", headers: authHeaders(), body: JSON.stringify({ hours }),
    });
    const d = await r.json();
    toast({ title: r.ok ? d.message : d.message || "Ошибка", variant: r.ok ? "default" : "destructive" });
    if (r.ok) fetchAdminSessions();
  }

  async function handleEndSession(id: string) {
    if (!confirm("Завершить сессию?")) return;
    const r = await fetch(`${BASE_URL}/api/admin/sessions/${id}/end`, { method: "POST", headers: authHeaders() });
    if (r.ok) { toast({ title: "Сессия завершена" }); fetchAdminSessions(); }
  }

  async function handleSyncPayment(externalId: string) {
    setPaymentSyncId(externalId);
    setPaymentSyncResult(null);
    try {
      const r = await fetch(`${BASE_URL}/api/admin/payments/${externalId}/sync`, { method: "POST", headers: authHeaders() });
      const d = await r.json();
      setPaymentSyncResult(d);
      if (!r.ok) toast({ variant: "destructive", title: d.message || "Ошибка синхронизации" });
    } finally { /* keep modal open */ }
  }

  async function handleBcPreview() {
    const r = await fetch(`${BASE_URL}/api/admin/broadcast/preview`, {
      method: "POST", headers: authHeaders(), body: JSON.stringify({ audience: bcAudience }),
    });
    if (r.ok) { const d = await r.json(); setBcPreview(d.count); }
  }

  async function handleBroadcast() {
    if (!bcSubject || !bcBody) return;
    if (!confirm(`Отправить ${bcPreview ?? "?"} писем?`)) return;
    setBcSending(true);
    try {
      const r = await fetch(`${BASE_URL}/api/admin/broadcast`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ audience: bcAudience, subject: bcSubject, body: bcBody }),
      });
      const d = await r.json();
      toast({ title: r.ok ? d.message : d.message || "Ошибка", variant: r.ok ? "default" : "destructive" });
      if (r.ok) { setBcSubject(""); setBcBody(""); }
    } finally { setBcSending(false); }
  }

  async function handleSaveSettings() {
    setSettingsSaving(true);
    try {
      const r = await fetch(`${BASE_URL}/api/admin/settings`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify(settings),
      });
      toast({ title: r.ok ? "Настройки сохранены" : "Ошибка", variant: r.ok ? "default" : "destructive" });
    } finally { setSettingsSaving(false); }
  }

  async function openUserDetail(userId: string) {
    setUserDetailLoading(true);
    try {
      const r = await fetch(`${BASE_URL}/api/admin/users/${userId}`, { headers: authHeaders() });
      if (r.ok) setSelectedUser(await r.json());
    } finally { setUserDetailLoading(false); }
  }

  async function handleAdjust() {
    if (!adjustUserId) return;
    const amount = parseFloat(adjustAmount);
    if (isNaN(amount) || amount === 0) { toast({ variant: "destructive", title: "Некорректная сумма" }); return; }
    setAdjustLoading(true);
    try {
      const r = await fetch(`${BASE_URL}/api/admin/users/${adjustUserId}/adjust`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ amount, reason: adjustReason || undefined }),
      });
      const d = await r.json();
      if (r.ok) {
        toast({ title: d.message });
        setAdjustUserId(null); setAdjustAmount(""); setAdjustReason("");
        fetchUsers(); fetchStats();
        if (selectedUser?.user.id === adjustUserId) openUserDetail(adjustUserId);
      } else { toast({ variant: "destructive", title: d.message || "Ошибка" }); }
    } finally { setAdjustLoading(false); }
  }

  async function handleToggleAdmin(userId: string) {
    const r = await fetch(`${BASE_URL}/api/admin/users/${userId}/toggle-admin`, { method: "POST", headers: authHeaders() });
    if (r.ok) {
      const d = await r.json();
      toast({ title: `Права администратора ${d.isAdmin ? "выданы" : "отозваны"}: ${d.name}` });
      fetchUsers();
    }
  }

  async function handleCreatePromo() {
    if (!newPromo.code || !newPromo.amount) return;
    setCreatingPromo(true);
    try {
      const r = await fetch(`${BASE_URL}/api/admin/promo`, {
        method: "POST", headers: authHeaders(),
        body: JSON.stringify({ ...newPromo, amount: parseFloat(newPromo.amount), max_uses: parseInt(newPromo.max_uses) || 100, expires_at: newPromo.expires_at || null }),
      });
      const d = await r.json();
      if (r.ok) { toast({ title: "Промокод создан" }); setPromos(p => [d, ...p]); setNewPromo({ code: "", amount: "", max_uses: "100", description: "", expires_at: "" }); }
      else toast({ variant: "destructive", title: d.message || "Ошибка" });
    } finally { setCreatingPromo(false); }
  }

  async function handleDeletePromo(id: number) {
    if (!confirm("Деактивировать промокод? Существующие активации сохранятся.")) return;
    const r = await fetch(`${BASE_URL}/api/admin/promo/${id}`, { method: "DELETE", headers: authHeaders() });
    if (r.ok) { toast({ title: "Промокод деактивирован" }); setPromos(p => p.map(x => x.id === id ? { ...x, is_active: false } : x)); }
  }

  async function handleSavePromo() {
    if (!editPromo) return;
    setSavingPromo(true);
    try {
      const body = {
        amount: parseFloat(editPromo.amount),
        max_uses: parseInt(editPromo.max_uses),
        description: editPromo.description || "",
        expires_at: editPromo.expires_at || null,
        is_active: !!editPromo.is_active,
      };
      const r = await fetch(`${BASE_URL}/api/admin/promo/${editPromo.id}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify(body) });
      const d = await r.json();
      if (r.ok) { toast({ title: "Промокод обновлён" }); setPromos(p => p.map(x => x.id === editPromo.id ? { ...x, ...d } : x)); setEditPromo(null); }
      else toast({ variant: "destructive", title: d.message || "Ошибка" });
    } finally { setSavingPromo(false); }
  }

  async function handleViewRedemptions(id: number) {
    setPromoDetailLoading(true); setPromoDetail({ id });
    try {
      const r = await fetch(`${BASE_URL}/api/admin/promo/${id}`, { headers: authHeaders() });
      const d = await r.json();
      if (r.ok) setPromoDetail(d); else { toast({ variant: "destructive", title: "Не удалось загрузить" }); setPromoDetail(null); }
    } finally { setPromoDetailLoading(false); }
  }

  async function handleBulkCreate() {
    setBulkRunning(true); setBulkResult(null);
    try {
      const body = {
        count: parseInt(bulkData.count) || 0,
        prefix: bulkData.prefix || "",
        length: parseInt(bulkData.length) || 8,
        amount: parseFloat(bulkData.amount),
        max_uses: parseInt(bulkData.max_uses) || 1,
        description: bulkData.description || "",
        expires_at: bulkData.expires_at || null,
      };
      const r = await fetch(`${BASE_URL}/api/admin/promo/bulk`, { method: "POST", headers: authHeaders(), body: JSON.stringify(body) });
      const d = await r.json();
      if (r.ok) {
        setBulkResult(d);
        toast({ title: `Создано ${d.created} промокодов`, description: d.failed ? `Не удалось: ${d.failed}` : undefined });
        fetchPromos();
      } else toast({ variant: "destructive", title: d.message || "Ошибка" });
    } finally { setBulkRunning(false); }
  }

  function downloadBulkCSV() {
    if (!bulkResult?.codes?.length) return;
    const csv = "code,amount\n" + bulkResult.codes.map((c: any) => `${c.code},${c.amount}`).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `promo-codes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }

  if (forbidden) {
    return (
      <div className="flex flex-col items-center justify-center py-32 text-center">
        <ShieldOff className="w-16 h-16 text-destructive mb-6 opacity-60" />
        <h2 className="text-2xl font-bold mb-3">Доступ запрещён</h2>
        <p className="text-muted-foreground mb-6">У вашего аккаунта нет прав администратора.</p>
        <Button onClick={() => setLocation("/dashboard")}>← На главную</Button>
      </div>
    );
  }

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: "overview", label: "Обзор", icon: BarChart3 },
    { key: "users", label: "Пользователи", icon: Users },
    { key: "tasks", label: "Задачи", icon: ListChecks },
    { key: "sessions", label: "Сессии", icon: MessageSquare },
    { key: "payments", label: "Платежи", icon: DollarSign },
    { key: "transactions", label: "Транзакции", icon: Wallet },
    { key: "promo", label: "Промокоды", icon: Tag },
    { key: "broadcast", label: "Рассылка", icon: Megaphone },
    { key: "health", label: "Здоровье AI", icon: Heart },
    { key: "pricing", label: "Тарифы", icon: DollarSign },
    { key: "settings", label: "Настройки", icon: SettingsIcon },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Панель администратора</h1>
            <p className="text-sm text-muted-foreground">НейроЗачёт — управление и аналитика</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => { fetchStats(); fetchAiStats(); }} className="border-white/10 gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Обновить
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/5 p-1 rounded-xl w-fit flex-wrap">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key ? "bg-primary text-white shadow-md" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* Key Metrics */}
          {!stats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => <div key={i} className="h-28 bg-card/40 rounded-xl animate-pulse" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { icon: Users, label: "Пользователей", value: stats.users.total, sub: `+${stats.users.today} сегодня`, color: "text-blue-400", bg: "bg-blue-400/10" },
                { icon: CheckCircle2, label: "Задач решено", value: stats.tasks.completed, sub: `${stats.tasks.pending} в очереди`, color: "text-green-400", bg: "bg-green-400/10" },
                { icon: Zap, label: "Сессий", value: stats.sessions.total, sub: `${stats.sessions.active} активных`, color: "text-violet-400", bg: "bg-violet-400/10" },
                { icon: TrendingUp, label: "Оборот", value: `${stats.revenue.total.toFixed(0)} ₽`, sub: "Всего пополнений", color: "text-amber-400", bg: "bg-amber-400/10" },
              ].map(({ icon: Icon, label, value, sub, color, bg }) => (
                <Card key={label} className="bg-card/40 border-white/5 hover:bg-card/60 transition-colors">
                  <CardContent className="pt-5">
                    <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center mb-3`}>
                      <Icon className={`w-4 h-4 ${color}`} />
                    </div>
                    <div className="text-2xl font-bold">{value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{label}</div>
                    <div className={`text-xs mt-0.5 ${color}`}>{sub}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* AI Usage by Tool */}
          {aiStats && (
            <Card className="bg-card/40 border-white/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  Использование AI-инструментов (последние 30 дней)
                  <Badge variant="secondary" className="ml-auto bg-white/5 text-xs">
                    Списано: {aiStats.totalRevenue30d.toFixed(0)} ₽
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {aiStats.tools.map((tool) => {
                    const Icon = TOOL_ICONS[tool.tool] || Zap;
                    const maxCount = Math.max(...aiStats.tools.map(t => t.count), 1);
                    const pct = Math.round((tool.count / maxCount) * 100);
                    return (
                      <div key={tool.tool} className="rounded-lg bg-white/3 border border-white/5 p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium">{tool.tool}</span>
                        </div>
                        <div className="text-2xl font-bold">{tool.count}</div>
                        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{tool.completed} выполнено</span>
                          {tool.cost > 0 && <span className="text-amber-400">{tool.cost.toFixed(0)} ₽</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Daily Activity */}
          {aiStats && aiStats.daily.length > 0 && (
            <Card className="bg-card/40 border-white/5">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" /> Активность за 7 дней
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-muted-foreground border-b border-white/5">
                        <th className="text-left py-2 pr-4">Дата</th>
                        <th className="text-right py-2 px-3">Задачи</th>
                        <th className="text-right py-2 px-3">Сессии</th>
                        <th className="text-right py-2 px-3">Списано ₽</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aiStats.daily.map((d: any) => (
                        <tr key={d.date} className="border-b border-white/5 hover:bg-white/2">
                          <td className="py-2 pr-4 text-muted-foreground">
                            {format(new Date(d.date), "d MMM", { locale: ru })}
                          </td>
                          <td className="py-2 px-3 text-right font-medium">{d.tasks}</td>
                          <td className="py-2 px-3 text-right font-medium">{d.sessions}</td>
                          <td className="py-2 px-3 text-right text-amber-400">{d.cost.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── USERS TAB ── */}
      {tab === "users" && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Поиск по имени или email..."
                value={usersSearchInput}
                onChange={e => setUsersSearchInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { setUsersSearch(usersSearchInput); setUsersPage(1); } }}
                className="pl-9 bg-white/5 border-white/10"
              />
            </div>
            <Button onClick={() => { setUsersSearch(usersSearchInput); setUsersPage(1); }} variant="outline" size="sm" className="border-white/10">
              <Search className="w-4 h-4 mr-1.5" /> Найти
            </Button>
            <Button onClick={() => { setUsersSearchInput(""); setUsersSearch(""); setUsersPage(1); }} variant="ghost" size="sm">
              <RefreshCw className="w-4 h-4" />
            </Button>
            <span className="ml-auto text-sm text-muted-foreground self-center">Всего: {usersTotal}</span>
          </div>

          <Card className="bg-card/40 border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/3 text-muted-foreground text-xs">
                    <th className="text-left py-3 px-4 font-medium">Пользователь</th>
                    <th className="text-left py-3 px-4 font-medium hidden md:table-cell">Email</th>
                    <th className="text-right py-3 px-4 font-medium">Баланс</th>
                    <th className="text-center py-3 px-4 font-medium hidden sm:table-cell">Задач</th>
                    <th className="text-center py-3 px-4 font-medium hidden lg:table-cell">Сессий</th>
                    <th className="text-right py-3 px-4 font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {usersLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className="border-b border-white/5">
                        <td colSpan={6} className="py-4 px-4"><div className="h-5 bg-white/5 rounded animate-pulse" /></td>
                      </tr>
                    ))
                  ) : users.length === 0 ? (
                    <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">Пользователи не найдены</td></tr>
                  ) : users.map(user => (
                    <tr
                      key={user.id}
                      className="border-b border-white/5 hover:bg-white/3 transition-colors cursor-pointer"
                      onClick={() => openUserDetail(user.id)}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                            {user.name.slice(0, 1).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium flex items-center gap-1">
                              {user.name}
                              {user.isAdmin && <ShieldCheck className="w-3 h-3 text-amber-400" />}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(user.createdAt), "d MMM yyyy", { locale: ru })}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 hidden md:table-cell">
                        <span className="text-muted-foreground text-xs">{user.email}</span>
                        {user.emailVerified && <span className="ml-1 text-green-400 text-xs">✓</span>}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className={`font-bold ${user.balance < 50 ? "text-red-400" : user.balance > 500 ? "text-green-400" : ""}`}>
                          {user.balance.toFixed(0)} ₽
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center hidden sm:table-cell">
                        <Badge variant="secondary" className="bg-white/5 text-xs">{user.tasksCount}</Badge>
                      </td>
                      <td className="py-3 px-4 text-center hidden lg:table-cell">
                        <Badge variant="secondary" className="bg-white/5 text-xs">{user.sessionsCount}</Badge>
                      </td>
                      <td className="py-3 px-4 text-right" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-1 justify-end">
                          <Button
                            size="sm" variant="outline"
                            className="h-7 text-xs border-white/10 hover:bg-primary/20 hover:border-primary/40 hover:text-primary"
                            onClick={() => { setAdjustUserId(user.id); setAdjustAmount(""); setAdjustReason(""); }}
                          >
                            <Wallet className="w-3 h-3 mr-1" /> Баланс
                          </Button>
                          <Button
                            size="sm" variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-amber-400"
                            title={user.isAdmin ? "Отозвать права" : "Сделать администратором"}
                            onClick={() => handleToggleAdmin(user.id)}
                          >
                            {user.isAdmin ? <ShieldOff className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {Math.ceil(usersTotal / LIMIT) > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setUsersPage(p => Math.max(1, p - 1))} disabled={usersPage === 1} className="border-white/10">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium px-2">{usersPage} / {Math.ceil(usersTotal / LIMIT)}</span>
              <Button variant="outline" size="sm" onClick={() => setUsersPage(p => Math.min(Math.ceil(usersTotal / LIMIT), p + 1))} disabled={usersPage === Math.ceil(usersTotal / LIMIT)} className="border-white/10">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── TRANSACTIONS TAB ── */}
      {tab === "transactions" && (
        <div className="space-y-4">
          {/* Filter */}
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-sm text-muted-foreground">Тип:</span>
            {["", "topup", "payment", "deduction", "bonus"].map(t => (
              <button
                key={t}
                onClick={() => { setTxType(t); setTxPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  txType === t ? "bg-primary text-white" : "bg-white/5 text-muted-foreground hover:bg-white/10"
                }`}
              >
                {t === "" ? "Все" : TX_TYPE_LABELS[t]?.label || t}
              </button>
            ))}
            <span className="ml-auto text-sm text-muted-foreground">Всего: {txTotal}</span>
          </div>

          <Card className="bg-card/40 border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/3 text-muted-foreground text-xs">
                    <th className="text-left py-3 px-4 font-medium">Пользователь</th>
                    <th className="text-left py-3 px-4 font-medium hidden sm:table-cell">Тип</th>
                    <th className="text-right py-3 px-4 font-medium">Сумма</th>
                    <th className="text-left py-3 px-4 font-medium hidden md:table-cell">Описание</th>
                    <th className="text-right py-3 px-4 font-medium">Дата</th>
                  </tr>
                </thead>
                <tbody>
                  {txLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b border-white/5">
                        <td colSpan={5} className="py-3.5 px-4"><div className="h-4 bg-white/5 rounded animate-pulse" /></td>
                      </tr>
                    ))
                  ) : transactions.length === 0 ? (
                    <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">Транзакции не найдены</td></tr>
                  ) : transactions.map(tx => {
                    const typeInfo = TX_TYPE_LABELS[tx.type] || { label: tx.type, color: "text-muted-foreground bg-white/5", icon: DollarSign };
                    const TxIcon = typeInfo.icon;
                    const isPositive = ["topup", "bonus", "refund"].includes(tx.type);
                    return (
                      <tr key={tx.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-medium text-sm">{tx.userName || `#${tx.userId}`}</div>
                          <div className="text-xs text-muted-foreground hidden sm:block">{tx.userEmail}</div>
                        </td>
                        <td className="py-3 px-4 hidden sm:table-cell">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${typeInfo.color}`}>
                            <TxIcon className="w-3 h-3" />
                            {typeInfo.label}
                          </span>
                        </td>
                        <td className={`py-3 px-4 text-right font-bold ${isPositive ? "text-green-400" : "text-red-400"}`}>
                          {isPositive ? "+" : "-"}{tx.amount.toFixed(0)} ₽
                        </td>
                        <td className="py-3 px-4 hidden md:table-cell">
                          <span className="text-muted-foreground text-xs truncate max-w-48 block">{tx.description}</span>
                        </td>
                        <td className="py-3 px-4 text-right text-xs text-muted-foreground">
                          {format(new Date(tx.createdAt), "d MMM, HH:mm", { locale: ru })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {Math.ceil(txTotal / TX_LIMIT) > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setTxPage(p => Math.max(1, p - 1))} disabled={txPage === 1} className="border-white/10">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium px-2">{txPage} / {Math.ceil(txTotal / TX_LIMIT)}</span>
              <Button variant="outline" size="sm" onClick={() => setTxPage(p => Math.min(Math.ceil(txTotal / TX_LIMIT), p + 1))} disabled={txPage === Math.ceil(txTotal / TX_LIMIT)} className="border-white/10">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── PROMO TAB ── */}
      {tab === "promo" && (
        <div className="space-y-4">
          <Card className="bg-card/40 border-white/5">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> Создать промокод</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { key: "code", label: "Код *", placeholder: "ЛЕТО2025", mono: true, transform: (v: string) => v.toUpperCase() },
                  { key: "amount", label: "Сумма (₽) *", placeholder: "100", type: "number" },
                  { key: "max_uses", label: "Макс. активаций", placeholder: "100", type: "number" },
                  { key: "description", label: "Описание", placeholder: "Летняя акция" },
                  { key: "expires_at", label: "Истекает", type: "date" },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-xs text-muted-foreground mb-1 block">{f.label}</label>
                    <Input
                      type={f.type || "text"} placeholder={f.placeholder}
                      value={(newPromo as any)[f.key]}
                      onChange={e => setNewPromo(p => ({ ...p, [f.key]: f.transform ? f.transform(e.target.value) : e.target.value }))}
                      className={`bg-background/50 ${f.mono ? "font-mono font-semibold" : ""}`}
                    />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={handleCreatePromo} disabled={creatingPromo || !newPromo.code || !newPromo.amount} className="gap-2">
                  <Plus className="w-4 h-4" /> {creatingPromo ? "Создание..." : "Создать промокод"}
                </Button>
                <Button variant="outline" onClick={() => { setBulkOpen(true); setBulkResult(null); }} className="gap-2">
                  <Tag className="w-4 h-4" /> Массовая генерация
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Фильтр:</span>
            {([
              { v: "all", l: "Все" },
              { v: "active", l: "Активные" },
              { v: "inactive", l: "Деактивированные" },
            ] as const).map(o => (
              <button
                key={o.v}
                onClick={() => setPromoFilter(o.v)}
                className={`px-2.5 py-1 rounded-md transition-colors ${promoFilter === o.v ? "bg-primary/20 text-primary" : "bg-card/40 text-muted-foreground hover:bg-card/60"}`}
              >{o.l}</button>
            ))}
            <span className="ml-auto text-muted-foreground">{promos.filter(p => promoFilter === "all" || (promoFilter === "active" ? p.is_active !== false : p.is_active === false)).length} шт.</span>
          </div>

          {promoLoading ? (
            <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-card/40 rounded-xl animate-pulse" />)}</div>
          ) : promos.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Tag className="w-10 h-10 mx-auto mb-3 opacity-30" /><p>Промокодов нет</p></div>
          ) : (
            <div className="space-y-2">
              {promos
                .filter(p => promoFilter === "all" || (promoFilter === "active" ? p.is_active !== false : p.is_active === false))
                .map(p => {
                  const isExpired = p.expires_at && new Date(p.expires_at) < new Date();
                  const isExhausted = (p.uses_count ?? 0) >= p.max_uses;
                  const isInactive = p.is_active === false;
                  return (
                    <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl bg-card/40 border border-white/5 hover:bg-card/60 transition-colors">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isInactive || isExpired || isExhausted ? "bg-muted/40" : "bg-primary/10"}`}>
                        <Tag className={`w-4 h-4 ${isInactive || isExpired || isExhausted ? "text-muted-foreground" : "text-primary"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-sm">{p.code}</span>
                          {isInactive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">Деактивирован</span>}
                          {isExpired && !isInactive && <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">Истёк</span>}
                          {isExhausted && !isInactive && !isExpired && <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-400">Лимит исчерпан</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {p.description || "—"} · {p.uses_count ?? 0}/{p.max_uses} активаций
                          {p.expires_at && <> · до {format(new Date(p.expires_at), "d MMM yyyy", { locale: ru })}</>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold text-green-400 text-sm">+{p.amount} ₽</div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button size="sm" variant="ghost" className="w-7 h-7 p-0 text-muted-foreground hover:text-primary" onClick={() => handleViewRedemptions(p.id)} title="Активации">
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="w-7 h-7 p-0 text-muted-foreground hover:text-primary" onClick={() => setEditPromo({ ...p, expires_at: p.expires_at ? String(p.expires_at).slice(0, 10) : "" })} title="Редактировать">
                          <Edit className="w-3.5 h-3.5" />
                        </Button>
                        {isInactive ? (
                          <Button size="sm" variant="ghost" className="w-7 h-7 p-0 text-muted-foreground hover:text-green-400" title="Активировать"
                            onClick={async () => {
                              const r = await fetch(`${BASE_URL}/api/admin/promo/${p.id}`, { method: "PATCH", headers: authHeaders(), body: JSON.stringify({ is_active: true }) });
                              if (r.ok) { toast({ title: "Активирован" }); setPromos(prev => prev.map(x => x.id === p.id ? { ...x, is_active: true } : x)); }
                            }}>
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                        ) : (
                          <Button size="sm" variant="ghost" className="w-7 h-7 p-0 text-muted-foreground hover:text-red-400" onClick={() => handleDeletePromo(p.id)} title="Деактивировать">
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* EDIT DIALOG */}
          {editPromo && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setEditPromo(null)}>
              <Card className="w-full max-w-lg" onClick={e => e.stopPropagation()}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Edit className="w-4 h-4" /> Редактировать <span className="font-mono">{editPromo.code}</span></CardTitle>
                  <CardDescription>Код изменить нельзя — он уникальный идентификатор</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Сумма (₽)</label>
                      <Input type="number" value={editPromo.amount} onChange={e => setEditPromo({ ...editPromo, amount: e.target.value })} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Макс. активаций</label>
                      <Input type="number" value={editPromo.max_uses} onChange={e => setEditPromo({ ...editPromo, max_uses: e.target.value })} />
                      <div className="text-[10px] text-muted-foreground mt-1">Использовано: {editPromo.uses_count ?? 0}</div>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Описание</label>
                    <Input value={editPromo.description || ""} onChange={e => setEditPromo({ ...editPromo, description: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Истекает</label>
                    <Input type="date" value={editPromo.expires_at || ""} onChange={e => setEditPromo({ ...editPromo, expires_at: e.target.value })} />
                  </div>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!!editPromo.is_active} onChange={e => setEditPromo({ ...editPromo, is_active: e.target.checked })} />
                    Активен
                  </label>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="ghost" onClick={() => setEditPromo(null)}>Отмена</Button>
                    <Button onClick={handleSavePromo} disabled={savingPromo}>{savingPromo ? "Сохранение..." : "Сохранить"}</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* REDEMPTIONS DIALOG */}
          {promoDetail && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setPromoDetail(null)}>
              <Card className="w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Eye className="w-4 h-4" /> Активации {promoDetail.promo && <span className="font-mono">{promoDetail.promo.code}</span>}
                  </CardTitle>
                  {promoDetail.promo && (
                    <CardDescription>
                      Использовано {promoDetail.promo.uses_count}/{promoDetail.promo.max_uses} ·
                      Всего начислено: <span className="text-green-400 font-semibold">{promoDetail.totalGranted} ₽</span>
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="overflow-y-auto">
                  {promoDetailLoading ? (
                    <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-card/40 rounded animate-pulse" />)}</div>
                  ) : !promoDetail.redemptions?.length ? (
                    <div className="text-center py-8 text-muted-foreground text-sm">Никто ещё не активировал</div>
                  ) : (
                    <div className="space-y-1.5">
                      {promoDetail.redemptions.map((r: any) => (
                        <div key={r.id} className="flex items-center gap-3 p-2 rounded bg-card/40 text-sm">
                          <div className="flex-1 min-w-0">
                            <div className="truncate">{r.userName || "—"}</div>
                            <div className="text-xs text-muted-foreground truncate">{r.userEmail} · ID {r.userId}</div>
                          </div>
                          <div className="text-green-400 font-semibold shrink-0">+{r.amount} ₽</div>
                          <div className="text-xs text-muted-foreground shrink-0">{format(new Date(r.createdAt), "d MMM, HH:mm", { locale: ru })}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-end pt-3">
                    <Button variant="ghost" onClick={() => setPromoDetail(null)}>Закрыть</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* BULK GENERATE DIALOG */}
          {bulkOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => !bulkRunning && setBulkOpen(false)}>
              <Card className="w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Tag className="w-4 h-4" /> Массовая генерация</CardTitle>
                  <CardDescription>Создать пачку уникальных промокодов с одинаковыми параметрами</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 overflow-y-auto">
                  {!bulkResult ? (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Количество (1–500)</label>
                          <Input type="number" value={bulkData.count} onChange={e => setBulkData({ ...bulkData, count: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Длина кода (4–16)</label>
                          <Input type="number" value={bulkData.length} onChange={e => setBulkData({ ...bulkData, length: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Префикс (опционально)</label>
                          <Input placeholder="ВУЗ" value={bulkData.prefix} onChange={e => setBulkData({ ...bulkData, prefix: e.target.value.toUpperCase() })} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Сумма (₽) *</label>
                          <Input type="number" value={bulkData.amount} onChange={e => setBulkData({ ...bulkData, amount: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Активаций на код</label>
                          <Input type="number" value={bulkData.max_uses} onChange={e => setBulkData({ ...bulkData, max_uses: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Истекает</label>
                          <Input type="date" value={bulkData.expires_at} onChange={e => setBulkData({ ...bulkData, expires_at: e.target.value })} />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Описание</label>
                        <Input placeholder="Партнёрская акция" value={bulkData.description} onChange={e => setBulkData({ ...bulkData, description: e.target.value })} />
                      </div>
                      <div className="text-xs text-muted-foreground p-2 rounded bg-card/40">
                        Пример: {bulkData.prefix ? `${bulkData.prefix.toUpperCase()}-` : ""}A1B2C3D4
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={() => setBulkOpen(false)} disabled={bulkRunning}>Отмена</Button>
                        <Button onClick={handleBulkCreate} disabled={bulkRunning || !bulkData.amount || !bulkData.count}>
                          {bulkRunning ? "Генерация..." : `Создать ${bulkData.count} шт.`}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-sm">
                        Создано: <span className="font-bold text-green-400">{bulkResult.created}</span>
                        {bulkResult.failed > 0 && <> · Не удалось: <span className="text-red-400">{bulkResult.failed}</span></>}
                      </div>
                      <div className="max-h-[300px] overflow-y-auto space-y-1 p-2 bg-card/40 rounded font-mono text-xs">
                        {bulkResult.codes.map((c: any) => (
                          <div key={c.id} className="flex justify-between">
                            <span>{c.code}</span>
                            <span className="text-green-400">+{c.amount} ₽</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={downloadBulkCSV}>Скачать CSV</Button>
                        <Button onClick={() => { setBulkResult(null); setBulkOpen(false); }}>Готово</Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* ── TASKS TAB ── */}
      {tab === "tasks" && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Поиск по теме..." value={adminTasksSearchInput}
                onChange={e => setAdminTasksSearchInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { setAdminTasksSearch(adminTasksSearchInput); setAdminTasksPage(1); } }}
                className="pl-9 bg-white/5 border-white/10" />
            </div>
            {["", "completed", "processing", "failed", "needs_manual", "refunded"].map(s => (
              <button key={s || "all"} onClick={() => { setAdminTasksStatus(s); setAdminTasksPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${adminTasksStatus === s ? "bg-primary text-white" : "bg-white/5 text-muted-foreground hover:bg-white/10"}`}>
                {s === "" ? "Все" : s === "completed" ? "Готово" : s === "processing" ? "Обработка" : s === "failed" ? "Ошибка" : s === "needs_manual" ? "Ручная" : "Возврат"}
              </button>
            ))}
            <span className="ml-auto text-sm text-muted-foreground">Всего: {adminTasksTotal}</span>
          </div>

          <Card className="bg-card/40 border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/3 text-muted-foreground text-xs">
                    <th className="text-left py-3 px-4 font-medium">ID</th>
                    <th className="text-left py-3 px-4 font-medium">Тема</th>
                    <th className="text-left py-3 px-4 font-medium hidden md:table-cell">Пользователь</th>
                    <th className="text-left py-3 px-4 font-medium">Статус</th>
                    <th className="text-right py-3 px-4 font-medium">Стоимость</th>
                    <th className="text-right py-3 px-4 font-medium hidden lg:table-cell">Дата</th>
                    <th className="text-right py-3 px-4 font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {adminTasksLoading ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-white/5"><td colSpan={7} className="py-3.5 px-4"><div className="h-4 bg-white/5 rounded animate-pulse" /></td></tr>
                  )) : adminTasks.length === 0 ? (
                    <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">Задач нет</td></tr>
                  ) : adminTasks.map(t => {
                    const statusColor = t.status === "completed" ? "text-green-400 bg-green-400/10" : t.status === "failed" ? "text-red-400 bg-red-400/10" : t.status === "processing" ? "text-amber-400 bg-amber-400/10" : t.status === "refunded" ? "text-violet-400 bg-violet-400/10" : "text-muted-foreground bg-white/5";
                    return (
                      <tr key={t.id} className="border-b border-white/5 hover:bg-white/2 transition-colors">
                        <td className="py-3 px-4 font-mono text-xs text-muted-foreground">#{t.id}</td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-sm truncate max-w-xs" title={t.title}>{t.title}</div>
                          <div className="text-xs text-muted-foreground">{t.subject} · {t.taskType}</div>
                        </td>
                        <td className="py-3 px-4 hidden md:table-cell text-xs">
                          <div>{t.userName}</div>
                          <div className="text-muted-foreground">{t.userEmail}</div>
                        </td>
                        <td className="py-3 px-4"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>{t.status}</span></td>
                        <td className="py-3 px-4 text-right text-sm font-medium">{(t.actualCost || t.estimatedCost || 0).toFixed(0)} ₽</td>
                        <td className="py-3 px-4 text-right text-xs text-muted-foreground hidden lg:table-cell">{format(new Date(t.createdAt), "d MMM HH:mm", { locale: ru })}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex gap-1 justify-end">
                            {(t.status === "failed" || t.status === "needs_manual") && (
                              <Button size="sm" variant="ghost" disabled={taskActionId === t.id} onClick={() => handleRetryTask(t.id)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-blue-400" title="Повторить">
                                <RotateCw className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {t.status !== "refunded" && (t.actualCost > 0 || t.estimatedCost > 0) && (
                              <Button size="sm" variant="ghost" disabled={taskActionId === t.id} onClick={() => handleRefundTask(t.id)}
                                className="h-7 w-7 p-0 text-muted-foreground hover:text-violet-400" title="Вернуть деньги">
                                <Undo2 className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {Math.ceil(adminTasksTotal / 30) > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setAdminTasksPage(p => Math.max(1, p - 1))} disabled={adminTasksPage === 1} className="border-white/10"><ChevronLeft className="w-4 h-4" /></Button>
              <span className="text-sm font-medium px-2">{adminTasksPage} / {Math.ceil(adminTasksTotal / 30)}</span>
              <Button variant="outline" size="sm" onClick={() => setAdminTasksPage(p => Math.min(Math.ceil(adminTasksTotal / 30), p + 1))} disabled={adminTasksPage >= Math.ceil(adminTasksTotal / 30)} className="border-white/10"><ChevronRight className="w-4 h-4" /></Button>
            </div>
          )}
        </div>
      )}

      {/* ── SESSIONS TAB ── */}
      {tab === "sessions" && (
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap items-center">
            <span className="text-sm text-muted-foreground">Статус:</span>
            {["", "active", "expired"].map(s => (
              <button key={s || "all"} onClick={() => { setAdminSessionsStatus(s); setAdminSessionsPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${adminSessionsStatus === s ? "bg-primary text-white" : "bg-white/5 text-muted-foreground hover:bg-white/10"}`}>
                {s === "" ? "Все" : s === "active" ? "Активные" : "Истёкшие"}
              </button>
            ))}
            <span className="ml-auto text-sm text-muted-foreground">Всего: {adminSessionsTotal}</span>
          </div>

          <Card className="bg-card/40 border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/3 text-muted-foreground text-xs">
                    <th className="text-left py-3 px-4 font-medium">Пользователь</th>
                    <th className="text-left py-3 px-4 font-medium">Пакет</th>
                    <th className="text-left py-3 px-4 font-medium">Статус</th>
                    <th className="text-center py-3 px-4 font-medium">Сообщ.</th>
                    <th className="text-right py-3 px-4 font-medium hidden md:table-cell">Истекает</th>
                    <th className="text-right py-3 px-4 font-medium">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {adminSessionsLoading ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-white/5"><td colSpan={6} className="py-3.5 px-4"><div className="h-4 bg-white/5 rounded animate-pulse" /></td></tr>
                  )) : adminSessions.length === 0 ? (
                    <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">Сессий нет</td></tr>
                  ) : adminSessions.map(s => {
                    const isActive = s.status === "active" && new Date(s.expiresAt) > new Date();
                    return (
                      <tr key={s.id} className="border-b border-white/5 hover:bg-white/2">
                        <td className="py-3 px-4">
                          <div className="font-medium text-sm">{s.userName}</div>
                          <div className="text-xs text-muted-foreground">{s.userEmail}</div>
                        </td>
                        <td className="py-3 px-4 text-sm">{s.packageType}</td>
                        <td className="py-3 px-4"><span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${isActive ? "text-green-400 bg-green-400/10" : "text-muted-foreground bg-white/5"}`}>{isActive ? "active" : "expired"}</span></td>
                        <td className="py-3 px-4 text-center text-sm">{s.messagesCount}</td>
                        <td className="py-3 px-4 text-right text-xs text-muted-foreground hidden md:table-cell">{s.expiresAt ? format(new Date(s.expiresAt), "d MMM HH:mm", { locale: ru }) : "—"}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="ghost" onClick={() => handleExtendSession(s.id)} className="h-7 w-7 p-0 text-muted-foreground hover:text-blue-400" title="Продлить">
                              <Timer className="w-3.5 h-3.5" />
                            </Button>
                            {isActive && (
                              <Button size="sm" variant="ghost" onClick={() => handleEndSession(s.id)} className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400" title="Завершить">
                                <PowerOff className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {Math.ceil(adminSessionsTotal / 30) > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setAdminSessionsPage(p => Math.max(1, p - 1))} disabled={adminSessionsPage === 1} className="border-white/10"><ChevronLeft className="w-4 h-4" /></Button>
              <span className="text-sm font-medium px-2">{adminSessionsPage} / {Math.ceil(adminSessionsTotal / 30)}</span>
              <Button variant="outline" size="sm" onClick={() => setAdminSessionsPage(p => Math.min(Math.ceil(adminSessionsTotal / 30), p + 1))} disabled={adminSessionsPage >= Math.ceil(adminSessionsTotal / 30)} className="border-white/10"><ChevronRight className="w-4 h-4" /></Button>
            </div>
          )}
        </div>
      )}

      {/* ── PAYMENTS TAB ── */}
      {tab === "payments" && (
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">Платежи ЮKassa, прошедшие через систему. Всего: {adminPaymentsTotal}</div>
          <Card className="bg-card/40 border-white/5 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/3 text-muted-foreground text-xs">
                    <th className="text-left py-3 px-4 font-medium">Пользователь</th>
                    <th className="text-right py-3 px-4 font-medium">Сумма</th>
                    <th className="text-left py-3 px-4 font-medium hidden md:table-cell">Описание</th>
                    <th className="text-left py-3 px-4 font-medium">ЮKassa ID</th>
                    <th className="text-right py-3 px-4 font-medium">Дата</th>
                    <th className="text-right py-3 px-4 font-medium">Сверка</th>
                  </tr>
                </thead>
                <tbody>
                  {adminPaymentsLoading ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-white/5"><td colSpan={6} className="py-3.5 px-4"><div className="h-4 bg-white/5 rounded animate-pulse" /></td></tr>
                  )) : adminPayments.length === 0 ? (
                    <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">Платежей нет</td></tr>
                  ) : adminPayments.map(p => (
                    <tr key={p.id} className="border-b border-white/5 hover:bg-white/2">
                      <td className="py-3 px-4">
                        <div className="font-medium text-sm">{p.userName}</div>
                        <div className="text-xs text-muted-foreground">{p.userEmail}</div>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-green-400">+{p.amount.toFixed(0)} ₽</td>
                      <td className="py-3 px-4 hidden md:table-cell"><span className="text-muted-foreground text-xs">{p.description}</span></td>
                      <td className="py-3 px-4 font-mono text-xs text-muted-foreground truncate max-w-xs">{p.externalPaymentId}</td>
                      <td className="py-3 px-4 text-right text-xs text-muted-foreground">{format(new Date(p.createdAt), "d MMM HH:mm", { locale: ru })}</td>
                      <td className="py-3 px-4 text-right">
                        <Button size="sm" variant="ghost" onClick={() => handleSyncPayment(p.externalPaymentId)} className="h-7 w-7 p-0 text-muted-foreground hover:text-blue-400" title="Сверить с ЮKassa">
                          <RefreshCw className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {Math.ceil(adminPaymentsTotal / 30) > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setAdminPaymentsPage(p => Math.max(1, p - 1))} disabled={adminPaymentsPage === 1} className="border-white/10"><ChevronLeft className="w-4 h-4" /></Button>
              <span className="text-sm font-medium px-2">{adminPaymentsPage} / {Math.ceil(adminPaymentsTotal / 30)}</span>
              <Button variant="outline" size="sm" onClick={() => setAdminPaymentsPage(p => Math.min(Math.ceil(adminPaymentsTotal / 30), p + 1))} disabled={adminPaymentsPage >= Math.ceil(adminPaymentsTotal / 30)} className="border-white/10"><ChevronRight className="w-4 h-4" /></Button>
            </div>
          )}
        </div>
      )}

      {/* ── BROADCAST TAB ── */}
      {tab === "broadcast" && (
        <div className="space-y-4 max-w-3xl">
          <Card className="bg-card/40 border-white/5">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Megaphone className="w-4 h-4 text-primary" /> Email-рассылка</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Аудитория</label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { v: "all", l: "Все подтверждённые" },
                    { v: "low_balance", l: "Баланс < 50 ₽" },
                    { v: "high_balance", l: "Баланс ≥ 500 ₽" },
                    { v: "inactive_30d", l: "Неактивны 30+ дней" },
                  ].map(o => (
                    <button key={o.v} onClick={() => { setBcAudience(o.v); setBcPreview(null); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${bcAudience === o.v ? "bg-primary text-white" : "bg-white/5 text-muted-foreground hover:bg-white/10"}`}>
                      {o.l}
                    </button>
                  ))}
                </div>
                <Button variant="ghost" size="sm" onClick={handleBcPreview} className="mt-2 text-xs">
                  <Eye className="w-3.5 h-3.5 mr-1" /> Посмотреть размер аудитории
                </Button>
                {bcPreview !== null && <span className="ml-2 text-sm text-amber-400">→ {bcPreview} получателей</span>}
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Тема письма</label>
                <Input value={bcSubject} onChange={e => setBcSubject(e.target.value)} placeholder="Например: Новые тарифы и скидки!" className="bg-white/5 border-white/10" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Текст письма (новая строка = новый абзац)</label>
                <textarea value={bcBody} onChange={e => setBcBody(e.target.value)} rows={8}
                  placeholder="Здравствуйте!&#10;&#10;Мы запустили новые тарифы..."
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-primary/40" />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleBroadcast} disabled={bcSending || !bcSubject || !bcBody} className="gap-2">
                  <Send className="w-4 h-4" /> {bcSending ? "Отправка..." : "Отправить рассылку"}
                </Button>
              </div>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">⚠ Рассылка отправляется в фоне с паузой 200мс между письмами. Не отправляйте более 2 писем в день одной аудитории — попадёте в спам.</p>
        </div>
      )}

      {/* ── HEALTH TAB ── */}
      {tab === "health" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Здоровье провайдеров</h3>
            <Button variant="outline" size="sm" onClick={fetchHealth} disabled={healthLoading} className="border-white/10 gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${healthLoading ? "animate-spin" : ""}`} /> Проверить
            </Button>
          </div>
          {!health ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[1,2,3,4,5,6,7].map(i => <div key={i} className="h-20 bg-card/40 rounded-xl animate-pulse" />)}</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {health.checks.map((c: any) => (
                <Card key={c.name} className={`bg-card/40 border ${c.ok ? "border-green-400/20" : "border-red-400/30"}`}>
                  <CardContent className="pt-4 pb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{c.name}</span>
                      <span className={`w-2 h-2 rounded-full ${c.ok ? "bg-green-400" : "bg-red-400"}`} />
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.ok ? `${c.latencyMs} мс` : c.error || "недоступен"}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card className="bg-card/40 border-white/5">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-red-400" /> Сбойные задачи за 24 часа ({recentFailed.length})</CardTitle></CardHeader>
            <CardContent>
              {recentFailed.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">Сбоев нет 🎉</div>
              ) : (
                <div className="space-y-2">
                  {recentFailed.map(t => (
                    <div key={t.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-white/3 border border-white/5">
                      <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">#{t.id} · {t.title}</div>
                        <div className="text-xs text-muted-foreground">{t.userName} · {t.subject} · {t.status}</div>
                        {t.errorMessage && <div className="text-xs text-red-400 mt-1 font-mono">{t.errorMessage}</div>}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => handleRetryTask(t.id)} className="h-7 w-7 p-0 text-muted-foreground hover:text-blue-400" title="Повторить">
                        <RotateCw className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-white/5">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><Crown className="w-4 h-4 text-amber-400" /> Топ-10 пользователей по тратам (30 дней)</CardTitle></CardHeader>
            <CardContent>
              {topUsers.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">Нет данных</div>
              ) : (
                <div className="space-y-1.5">
                  {topUsers.map((u, i) => (
                    <div key={u.userId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/3">
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? "bg-amber-400/20 text-amber-400" : "bg-white/5 text-muted-foreground"}`}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{u.name}</div>
                        <div className="text-xs text-muted-foreground">{u.email} · {u.count} операций</div>
                      </div>
                      <div className="text-sm font-bold text-amber-400">{u.total.toFixed(0)} ₽</div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── SETTINGS TAB ── */}
      {tab === "pricing" && (
        <PricingEditor settings={settings} setSettings={setSettings} onSave={handleSaveSettings} saving={settingsSaving} />
      )}

      {tab === "settings" && (
        <div className="space-y-4 max-w-2xl">
          <Card className="bg-card/40 border-white/5">
            <CardHeader><CardTitle className="text-base flex items-center gap-2"><SettingsIcon className="w-4 h-4 text-primary" /> Глобальные настройки</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {!settings ? <div className="h-32 bg-white/5 rounded animate-pulse" /> : (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Приветственный бонус при регистрации, ₽</label>
                    <Input type="number" value={settings.welcomeBonus ?? 100}
                      onChange={e => setSettings({ ...settings, welcomeBonus: parseFloat(e.target.value) || 0 })}
                      className="bg-white/5 border-white/10" />
                    <p className="text-xs text-muted-foreground mt-1">Начисляется сразу после регистрации (даже без подтверждения email).</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Бонус за подтверждение email, ₽</label>
                    <Input type="number" value={settings.verifyBonus ?? 0}
                      onChange={e => setSettings({ ...settings, verifyBonus: parseFloat(e.target.value) || 0 })}
                      className="bg-white/5 border-white/10" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Объявление на главной (пусто = скрыто)</label>
                    <textarea value={settings.announcement ?? ""}
                      onChange={e => setSettings({ ...settings, announcement: e.target.value })}
                      rows={3} placeholder="Например: Завтра с 02:00 до 04:00 будут технические работы"
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm focus:outline-none focus:border-primary/40" />
                  </div>
                  <div className="flex items-center gap-3">
                    <input type="checkbox" id="maint" checked={!!settings.maintenanceMode}
                      onChange={e => setSettings({ ...settings, maintenanceMode: e.target.checked })}
                      className="w-4 h-4 accent-primary" />
                    <label htmlFor="maint" className="text-sm">Режим обслуживания (закрыть сайт для не-админов)</label>
                  </div>
                  <Button onClick={handleSaveSettings} disabled={settingsSaving} className="gap-2">
                    {settingsSaving ? "Сохранение..." : "Сохранить"}
                  </Button>
                  <p className="text-xs text-muted-foreground">⚠ Чтобы настройки начали применяться к регистрации/баннеру, нужны соответствующие хуки в коде. Сейчас сохраняется только в БД <code className="text-amber-400">Neyrozachet_settings</code>.</p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── PAYMENT SYNC MODAL ── */}
      {paymentSyncId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="bg-card border-white/10 w-full max-w-lg shadow-2xl">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2"><RefreshCw className="w-5 h-5 text-primary" /> Сверка с ЮKassa</CardTitle>
                <Button variant="ghost" size="sm" className="w-7 h-7 p-0" onClick={() => { setPaymentSyncId(null); setPaymentSyncResult(null); }}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-xs text-muted-foreground font-mono">{paymentSyncId}</div>
              {!paymentSyncResult ? (
                <div className="text-center py-6 text-sm text-muted-foreground">Загрузка...</div>
              ) : (
                <pre className="text-xs bg-black/40 p-3 rounded-lg overflow-auto max-h-96 font-mono">{JSON.stringify(paymentSyncResult, null, 2)}</pre>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── BALANCE ADJUST MODAL ── */}
      {adjustUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="bg-card border-white/10 w-full max-w-sm shadow-2xl">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-primary" /> Корректировка баланса
                </CardTitle>
                <Button variant="ghost" size="sm" className="w-7 h-7 p-0" onClick={() => setAdjustUserId(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Введите положительную сумму для пополнения или отрицательную для списания.
              </p>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Сумма (₽)</label>
                <Input
                  type="number" placeholder="+100 или -50"
                  value={adjustAmount}
                  onChange={e => setAdjustAmount(e.target.value)}
                  className="bg-white/5 border-white/10"
                  autoFocus
                />
                <p className="text-xs text-muted-foreground mt-1">+ пополнение, − списание</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-1.5 block">Причина (необязательно)</label>
                <Input
                  placeholder="Например: оплата через Telegram..."
                  value={adjustReason}
                  onChange={e => setAdjustReason(e.target.value)}
                  className="bg-white/5 border-white/10"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1 border-white/10" onClick={() => setAdjustUserId(null)} disabled={adjustLoading}>
                  Отмена
                </Button>
                <Button
                  className={`flex-1 ${parseFloat(adjustAmount) < 0 ? "bg-red-600 hover:bg-red-500" : ""}`}
                  onClick={handleAdjust}
                  disabled={adjustLoading || !adjustAmount || parseFloat(adjustAmount) === 0}
                >
                  {adjustLoading ? "..." : parseFloat(adjustAmount) < 0 ? "Списать" : "Пополнить"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── USER DETAIL MODAL ── */}
      {(selectedUser || userDetailLoading) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card className="bg-card border-white/10 w-full max-w-2xl max-h-[85vh] shadow-2xl flex flex-col">
            <CardHeader className="pb-4 shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">
                  {userDetailLoading ? "Загрузка..." : selectedUser?.user.name}
                </CardTitle>
                <Button variant="ghost" size="sm" className="w-7 h-7 p-0" onClick={() => setSelectedUser(null)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            {userDetailLoading ? (
              <CardContent><div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-12 bg-white/5 rounded animate-pulse" />)}</div></CardContent>
            ) : selectedUser && (
              <CardContent className="overflow-y-auto space-y-5">
                {/* User Info */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Email", value: selectedUser.user.email },
                    { label: "Баланс", value: `${selectedUser.user.balance?.toFixed(2)} ₽`, highlight: true },
                    { label: "Уровень образования", value: selectedUser.user.educationLevel || "—" },
                    { label: "Вуз", value: (selectedUser.user as any).institution || "—" },
                    { label: "Специальность", value: (selectedUser.user as any).specialty || "—" },
                    { label: "Регистрация", value: format(new Date(selectedUser.user.createdAt), "d MMMM yyyy", { locale: ru }) },
                  ].map(({ label, value, highlight }) => (
                    <div key={label} className="space-y-0.5">
                      <div className="text-xs text-muted-foreground">{label}</div>
                      <div className={`text-sm font-medium ${highlight ? "text-amber-400" : ""}`}>{value}</div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm" variant="outline"
                    className="border-white/10 gap-1.5"
                    onClick={() => { setSelectedUser(null); setAdjustUserId(selectedUser.user.id); setAdjustAmount(""); setAdjustReason(""); }}
                  >
                    <Wallet className="w-3.5 h-3.5" /> Корректировка баланса
                  </Button>
                  <Button
                    size="sm" variant="ghost"
                    className="gap-1.5 text-muted-foreground"
                    onClick={() => handleToggleAdmin(selectedUser.user.id)}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {selectedUser.user.isAdmin ? "Отозвать права" : "Сделать администратором"}
                  </Button>
                </div>

                {/* Recent Transactions */}
                {selectedUser.transactions.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Wallet className="w-3.5 h-3.5 text-muted-foreground" /> Последние транзакции
                    </h4>
                    <div className="space-y-1">
                      {selectedUser.transactions.slice(0, 10).map(tx => {
                        const typeInfo = TX_TYPE_LABELS[tx.type] || { label: tx.type, color: "text-muted-foreground", icon: DollarSign };
                        const isPos = ["topup", "bonus", "refund"].includes(tx.type);
                        return (
                          <div key={tx.id} className="flex items-center gap-2 py-1.5 border-b border-white/5 text-sm">
                            <span className={`text-xs ${typeInfo.color.split(" ")[0]}`}>{typeInfo.label}</span>
                            <span className="flex-1 text-muted-foreground text-xs truncate">{tx.description}</span>
                            <span className={`font-bold shrink-0 ${isPos ? "text-green-400" : "text-red-400"}`}>
                              {isPos ? "+" : "-"}{tx.amount.toFixed(0)} ₽
                            </span>
                            <span className="text-xs text-muted-foreground shrink-0">
                              {format(new Date(tx.createdAt), "d MMM", { locale: ru })}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Recent Tasks */}
                {selectedUser.recentTasks.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground" /> Последние задачи
                    </h4>
                    <div className="space-y-1">
                      {selectedUser.recentTasks.slice(0, 5).map(task => (
                        <div key={task.id} className="flex items-center gap-2 py-1.5 border-b border-white/5 text-sm">
                          <Badge variant="secondary" className={`text-xs shrink-0 ${
                            task.status === "completed" ? "bg-green-400/10 text-green-400" :
                            task.status === "failed" ? "bg-red-400/10 text-red-400" :
                            "bg-white/5"
                          }`}>
                            {task.status === "completed" ? "✓" : task.status === "failed" ? "✗" : "⋯"}
                          </Badge>
                          <span className="flex-1 truncate">{task.title}</span>
                          <span className="text-xs text-muted-foreground shrink-0">{task.subject}</span>
                          {task.actual_cost && <span className="text-xs text-amber-400 shrink-0">{task.actual_cost} ₽</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Tarif редактор: правит settings.pricing (deep-merged поверх PRICING_DEFAULTS)
// ──────────────────────────────────────────────────────────────────────────────
function PricingEditor({
  settings, setSettings, onSave, saving,
}: { settings: any; setSettings: (s: any) => void; onSave: () => void; saving: boolean }) {
  if (!settings) return <div className="h-32 bg-white/5 rounded animate-pulse max-w-3xl" />;

  const pricing = settings.pricing || {};
  const update = (path: string[], value: any) => {
    const next = JSON.parse(JSON.stringify(pricing));
    let cur: any = next;
    for (let i = 0; i < path.length - 1; i++) { cur[path[i]] = cur[path[i]] ?? {}; cur = cur[path[i]]; }
    cur[path[path.length - 1]] = value;
    setSettings({ ...settings, pricing: next });
  };

  const taskModes = pricing.taskModes || {};
  const sessionPackages = pricing.sessionPackages || {};
  const sessionSurcharges = pricing.sessionModelSurcharges || {};
  const cw = pricing.coursework || { chapterCosts: {}, referencesCost: 15, revisionDiscount: 0.7 };
  const sm = pricing.summary || {};
  const payments = pricing.payments || {};
  const img = pricing.imageGeneration || {};

  const NumberRow = ({ label, value, onChange, suffix = "₽", step = 1 }: any) => (
    <div className="flex items-center gap-3 py-1.5">
      <label className="text-xs text-muted-foreground flex-1 min-w-0 truncate">{label}</label>
      <Input type="number" step={step} value={value ?? ""} onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-24 h-8 bg-white/5 border-white/10 text-right" />
      <span className="text-xs text-muted-foreground w-6">{suffix}</span>
    </div>
  );

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2"><DollarSign className="w-5 h-5 text-primary" /> Управление ценами</h2>
          <p className="text-xs text-muted-foreground mt-1">Изменения сохраняются в <code className="text-amber-400">Neyrozachet_settings</code> (key=<code>pricing</code>) и применяются мгновенно.</p>
        </div>
        <Button onClick={onSave} disabled={saving} className="gap-2">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Сохранить все цены"}
        </Button>
      </div>

      {/* Задачи (режимы) */}
      <Card className="bg-card/40 border-white/5">
        <CardHeader><CardTitle className="text-base">Режимы задач (₽ за задачу)</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-x-6">
          {Object.entries(taskModes).length === 0 ? (
            <p className="text-xs text-muted-foreground col-span-2">Используются значения по умолчанию. Задайте оверрайд ниже.</p>
          ) : Object.entries(taskModes).map(([key, val]: any) => (
            <NumberRow key={key} label={`${val.label || key}`} value={val.price}
              onChange={(v: number) => update(["taskModes", key, "price"], v)} />
          ))}
          <div className="col-span-2 mt-3">
            <p className="text-[11px] text-muted-foreground">Ключи режимов: <code>fast</code>, <code>standard</code>, <code>deep</code>, <code>premium</code>, <code>tickets</code>. Чтобы изменить — добавьте режим вручную (см. JSON-режим внизу).</p>
          </div>
        </CardContent>
      </Card>

      {/* Сессии — пакеты */}
      <Card className="bg-card/40 border-white/5">
        <CardHeader><CardTitle className="text-base">Чат-сессии — пакеты времени</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-x-6">
          {Object.entries(sessionPackages).map(([key, p]: any) => (
            <NumberRow key={key} label={`${p.name || key} (${p.durationHours}ч)`} value={p.price}
              onChange={(v: number) => update(["sessionPackages", key, "price"], v)} />
          ))}
        </CardContent>
      </Card>

      {/* Сессии — наценки за модель */}
      <Card className="bg-card/40 border-white/5">
        <CardHeader><CardTitle className="text-base">Наценка за модель (к пакету сессии, ₽)</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-x-6">
          {Object.entries(sessionSurcharges).map(([modelId, val]: any) => (
            <NumberRow key={modelId} label={modelId} value={val}
              onChange={(v: number) => update(["sessionModelSurcharges", modelId], v)} />
          ))}
        </CardContent>
      </Card>

      {/* Курсовые */}
      <Card className="bg-card/40 border-white/5">
        <CardHeader><CardTitle className="text-base">Научные работы (₽ за раздел)</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-x-6">
          {Object.entries(cw.chapterCosts || {}).map(([key, val]: any) => (
            <NumberRow key={key} label={key} value={val}
              onChange={(v: number) => update(["coursework", "chapterCosts", key], v)} />
          ))}
          <NumberRow label="Список литературы" value={cw.referencesCost}
            onChange={(v: number) => update(["coursework", "referencesCost"], v)} />
          <NumberRow label="Доля стоимости за платную доработку (0..1)" value={cw.revisionDiscount} step={0.05} suffix=""
            onChange={(v: number) => update(["coursework", "revisionDiscount"], v)} />
        </CardContent>
      </Card>

      {/* Конспекты */}
      <Card className="bg-card/40 border-white/5">
        <CardHeader><CardTitle className="text-base">Конспекты (₽)</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-x-6">
          {Object.entries(sm).map(([key, val]: any) => (
            <NumberRow key={key} label={`${val.label || key}`} value={val.price}
              onChange={(v: number) => update(["summary", key, "price"], v)} />
          ))}
        </CardContent>
      </Card>

      {/* Изображения */}
      <Card className="bg-card/40 border-white/5">
        <CardHeader><CardTitle className="text-base">Генерация изображений (₽)</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-x-6">
          {Object.entries(img).map(([key, val]: any) => (
            <NumberRow key={key} label={key} value={val as number}
              onChange={(v: number) => update(["imageGeneration", key], v)} />
          ))}
        </CardContent>
      </Card>

      {/* Платежи / пакеты пополнения */}
      <Card className="bg-card/40 border-white/5">
        <CardHeader><CardTitle className="text-base">Пакеты пополнения и подписки</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(payments).map(([key, p]: any) => (
            <div key={key} className="grid sm:grid-cols-4 gap-3 items-center p-3 rounded-lg bg-white/5 border border-white/10">
              <div className="text-sm font-semibold flex items-center gap-2">
                <code className="text-xs text-amber-400">{key}</code>
                <span className="text-xs text-muted-foreground">{p.type === "subscription" ? "подписка" : "пополнение"}</span>
              </div>
              <NumberRow label="Цена" value={p.price}
                onChange={(v: number) => update(["payments", key, "price"], v)} />
              {p.type === "subscription" ? (
                <NumberRow label="Длительность (дней)" suffix="дн" value={p.durationDays}
                  onChange={(v: number) => update(["payments", key, "durationDays"], v)} />
              ) : (
                <NumberRow label="На баланс" value={p.credit}
                  onChange={(v: number) => update(["payments", key, "credit"], v)} />
              )}
              <div className="text-xs text-muted-foreground truncate">{p.label || ""}</div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Расширенный JSON */}
      <Card className="bg-card/40 border-white/5">
        <CardHeader><CardTitle className="text-base">Сырой JSON (для расширенных правок)</CardTitle></CardHeader>
        <CardContent>
          <textarea
            value={JSON.stringify(pricing, null, 2)}
            onChange={(e) => {
              try { setSettings({ ...settings, pricing: JSON.parse(e.target.value) }); }
              catch { /* ignore until valid */ }
            }}
            rows={14}
            className="w-full px-3 py-2 rounded-lg bg-black/40 border border-white/10 text-xs font-mono focus:outline-none focus:border-primary/40"
          />
          <p className="text-[11px] text-muted-foreground mt-2">Правки накладываются поверх дефолтов (deep-merge). Очистите поле, чтобы сбросить все цены к умолчаниям.</p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={onSave} disabled={saving} className="gap-2">
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Сохранить все цены"}
        </Button>
      </div>
    </div>
  );
}
