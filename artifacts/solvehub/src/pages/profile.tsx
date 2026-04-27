import { useState, useEffect } from "react";
import { useGetProfile, useGetBalance, useUpdateProfile } from "@workspace/api-client-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, CreditCard, ArrowDownRight, ArrowUpRight, GraduationCap,
  Gift, Users, Copy, Check, Tag, ExternalLink, Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

function getAuthHeaders() {
  const token = localStorage.getItem("authToken");
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

const profileSchema = z.object({
  name: z.string().min(2, "Имя должно содержать минимум 2 символа"),
  educationLevel: z.enum(["school", "bachelor", "master", "phd", "other"]),
  institution: z.string().optional(),
  specialty: z.string().optional(),
});

export default function ProfilePage() {
  const { data: profile, isLoading: profileLoading } = useGetProfile();
  const { data: balanceData, isLoading: balanceLoading, refetch: refetchBalance } = useGetBalance();
  const updateMutation = useUpdateProfile();
  const { toast } = useToast();

  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [referralData, setReferralData] = useState<{ referralCode: string; referralLink: string; referredCount: number; totalEarned: number } | null>(null);
  const [referralLoading, setReferralLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    setReferralLoading(true);
    fetch("/api/referral", { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(data => setReferralData(data))
      .catch(() => {})
      .finally(() => setReferralLoading(false));
  }, []);

  const handlePromoRedeem = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    try {
      const r = await fetch("/api/promo/redeem", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ code: promoCode.trim() }),
      });
      const data = await r.json();
      if (!r.ok) {
        toast({ variant: "destructive", title: "Ошибка", description: data.message || "Промокод не найден или уже использован" });
      } else {
        toast({ title: "Промокод активирован!", description: data.message });
        setPromoCode("");
        refetchBalance();
      }
    } catch {
      toast({ variant: "destructive", title: "Ошибка", description: "Не удалось применить промокод" });
    } finally {
      setPromoLoading(false);
    }
  };

  const copyReferralLink = () => {
    if (!referralData?.referralLink) return;
    navigator.clipboard.writeText(referralData.referralLink);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    values: {
      name: profile?.name || "",
      educationLevel: (profile?.educationLevel as any) || "bachelor",
      institution: profile?.institution || "",
      specialty: profile?.specialty || "",
    },
  });

  const onSubmit = (values: z.infer<typeof profileSchema>) => {
    updateMutation.mutate({ data: values }, {
      onSuccess: () => {
        toast({
          title: "Профиль обновлен",
          description: "Ваши данные успешно сохранены.",
        });
      },
      onError: () => {
        toast({
          variant: "destructive",
          title: "Ошибка",
          description: "Не удалось обновить профиль.",
        });
      }
    });
  };

  if (profileLoading || balanceLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Настройки профиля</h1>
        <p className="text-muted-foreground mt-1">Управляйте личными данными и балансом.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-1 space-y-6">
          <Card className="bg-card/40 border-white/5 backdrop-blur-sm overflow-hidden">
            <div className="h-24 bg-gradient-to-r from-blue-600 to-violet-600"></div>
            <CardContent className="px-6 pb-6 pt-0 relative">
              <div className="w-20 h-20 rounded-full border-4 border-background bg-card flex items-center justify-center text-2xl font-bold shadow-xl -mt-10 mb-4 bg-background">
                {profile?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <h2 className="text-xl font-bold">{profile?.name}</h2>
              <p className="text-sm text-muted-foreground mb-4">{profile?.email}</p>
              
              <div className="space-y-3 pt-4 border-t border-white/10">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Задач решено</span>
                  <span className="text-sm font-medium">{profile?.completedTasksCount || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Всего задач</span>
                  <span className="text-sm font-medium">{profile?.totalTasksCount || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">На платформе с</span>
                  <span className="text-sm font-medium">
                    {profile?.createdAt ? format(new Date(profile.createdAt), "MMM yyyy", { locale: ru }) : '-'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/40 border-white/5 backdrop-blur-sm border-primary/20 shadow-[0_0_20px_rgba(124,58,237,0.1)]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CreditCard className="h-5 w-5 text-primary" />
                Баланс
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold mb-4">{balanceData?.balance || 0} ₽</div>
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
                Пополнить
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2">
          <Tabs defaultValue="general">
            <TabsList className="mb-4 bg-background border border-white/10 flex-wrap h-auto">
              <TabsTrigger value="general">Настройки</TabsTrigger>
              <TabsTrigger value="billing">Транзакции</TabsTrigger>
              <TabsTrigger value="referral" className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5" />Рефералы</TabsTrigger>
              <TabsTrigger value="promo" className="flex items-center gap-1.5"><Tag className="h-3.5 w-3.5" />Промокод</TabsTrigger>
            </TabsList>
            
            <TabsContent value="general" className="mt-0">
              <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>Личные данные</CardTitle>
                  <CardDescription>
                    Эта информация помогает ИИ лучше понимать контекст ваших задач.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Имя</FormLabel>
                            <FormControl>
                              <Input {...field} className="bg-background/50" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="educationLevel"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Уровень образования</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger className="bg-background/50">
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="school">Школьник</SelectItem>
                                <SelectItem value="bachelor">Бакалавриат / Специалитет</SelectItem>
                                <SelectItem value="master">Магистратура</SelectItem>
                                <SelectItem value="phd">Аспирантура</SelectItem>
                                <SelectItem value="other">Другое</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="institution"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Учебное заведение (необязательно)</FormLabel>
                              <FormControl>
                                <Input placeholder="Например: МГУ, ВШЭ, МФТИ..." {...field} className="bg-background/50" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="specialty"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Специальность (необязательно)</FormLabel>
                              <FormControl>
                                <Input placeholder="Например: ПМИ, Экономика..." {...field} className="bg-background/50" />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={updateMutation.isPending}>
                          {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Сохранить изменения
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="billing" className="mt-0">
              <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle>История транзакций</CardTitle>
                  <CardDescription>
                    Списания за задачи и пополнения баланса.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-md border border-white/10 overflow-hidden">
                    <Table>
                      <TableHeader className="bg-white/5">
                        <TableRow className="border-white/10 hover:bg-transparent">
                          <TableHead>Дата</TableHead>
                          <TableHead>Описание</TableHead>
                          <TableHead className="text-right">Сумма</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {balanceData?.transactions && balanceData.transactions.length > 0 ? (
                          balanceData.transactions.map((tx) => (
                            <TableRow key={tx.id} className="border-white/10 hover:bg-white/5">
                              <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                                {format(new Date(tx.createdAt), "d MMM, HH:mm", { locale: ru })}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  {tx.type === 'topup' ? (
                                    <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
                                      <ArrowDownRight className="w-3 h-3 text-green-500" />
                                    </div>
                                  ) : tx.type === 'refund' ? (
                                    <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                                      <ArrowDownRight className="w-3 h-3 text-blue-500" />
                                    </div>
                                  ) : (
                                    <div className="w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
                                      <ArrowUpRight className="w-3 h-3 text-orange-500" />
                                    </div>
                                  )}
                                  <span className="font-medium text-sm">{tx.description}</span>
                                </div>
                              </TableCell>
                              <TableCell className={`text-right font-medium whitespace-nowrap ${tx.type === 'payment' ? 'text-white' : 'text-green-500'}`}>
                                {tx.type === 'payment' ? '-' : '+'}{tx.amount} ₽
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={3} className="h-24 text-center text-muted-foreground">
                              Транзакций пока нет
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            {/* Referral tab */}
            <TabsContent value="referral" className="mt-0">
              <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Gift className="h-5 w-5 text-primary" /> Реферальная программа</CardTitle>
                  <CardDescription>Приглашайте друзей и получайте бонусы за каждого нового пользователя.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* How it works */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { icon: Users, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", label: "Поделитесь ссылкой", desc: "Отправьте реферальную ссылку другу" },
                      { icon: Sparkles, color: "text-violet-400", bg: "bg-violet-500/10 border-violet-500/20", label: "Друг регистрируется", desc: "Новый пользователь создаёт аккаунт" },
                      { icon: Gift, color: "text-green-400", bg: "bg-green-500/10 border-green-500/20", label: "Оба получают бонус", desc: "Вы +100 ₽, друг +50 ₽ к балансу" },
                    ].map(({ icon: Icon, color, bg, label, desc }) => (
                      <div key={label} className={`p-4 rounded-xl border ${bg}`}>
                        <div className={`w-8 h-8 rounded-lg ${bg} border ${bg} flex items-center justify-center mb-3`}>
                          <Icon className={`w-4 h-4 ${color}`} />
                        </div>
                        <p className="font-semibold text-sm mb-1">{label}</p>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                    ))}
                  </div>

                  {/* Referral code */}
                  {referralLoading ? (
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                      <Loader2 className="h-4 w-4 animate-spin" /> Загрузка...
                    </div>
                  ) : referralData ? (
                    <div className="space-y-4">
                      <div>
                        <p className="text-sm font-medium mb-2">Ваш реферальный код</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 font-mono font-bold text-xl tracking-widest bg-primary/10 border border-primary/20 text-primary px-4 py-3 rounded-xl">
                            {referralData.referralCode}
                          </div>
                          <Button variant="outline" size="icon" onClick={copyReferralLink} className="h-12 w-12 border-white/10 shrink-0">
                            {copiedCode ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                          </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 break-all">{referralData.referralLink}</p>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                          <div className="text-2xl font-bold text-primary">{referralData.referredCount}</div>
                          <div className="text-xs text-muted-foreground mt-1">Приглашено друзей</div>
                        </div>
                        <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
                          <div className="text-2xl font-bold text-green-400">+{referralData.totalEarned} ₽</div>
                          <div className="text-xs text-muted-foreground mt-1">Заработано бонусов</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Не удалось загрузить реферальные данные</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Promo code tab */}
            <TabsContent value="promo" className="mt-0">
              <Card className="bg-card/40 border-white/5 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Tag className="h-5 w-5 text-primary" /> Промокод</CardTitle>
                  <CardDescription>Введите промокод, чтобы пополнить баланс.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="max-w-md space-y-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Введите промокод (например: ЛЕТО2025)"
                        value={promoCode}
                        onChange={e => setPromoCode(e.target.value.toUpperCase())}
                        className="bg-background/50 font-mono font-semibold tracking-wider"
                        onKeyDown={e => { if (e.key === "Enter") handlePromoRedeem(); }}
                      />
                      <Button onClick={handlePromoRedeem} disabled={promoLoading || !promoCode.trim()}>
                        {promoLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Применить"}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Промокоды выдаются на акциях, в социальных сетях или партнёрских программах. Каждый код можно использовать только один раз.</p>
                  </div>

                  <div className="border-t border-white/10 pt-4">
                    <p className="text-sm font-medium mb-3">Где взять промокод?</p>
                    <div className="space-y-2">
                      {[
                        "Следите за нашими анонсами в социальных сетях",
                        "Участвуйте в партнёрских программах",
                        "Приглашайте друзей — и те, и другие получают бонусы",
                      ].map((t, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="w-5 h-5 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">{i + 1}</span>
                          {t}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
