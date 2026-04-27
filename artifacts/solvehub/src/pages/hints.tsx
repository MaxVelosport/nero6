import { useState, useMemo } from "react";
import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import "katex/dist/katex.min.css";
import { InlineMath, BlockMath } from "react-katex";
import {
  Copy, CheckCheck, Zap, Star, BookOpen, Code2,
  Calculator, FlaskConical, FileText, MessageSquarePlus,
  BrainCircuit, Target, AlertTriangle, CheckCircle2,
  Lightbulb, BarChart2, Scale, Globe, Atom, Microscope,
  TrendingUp, Music, Sigma, Search, X, Wand2, Sparkles, ChevronDown, ChevronUp,
  ArrowRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useGetMe } from "@workspace/api-client-react";

// LaTeX formula preview component
function Formula({ tex, block = false }: { tex: string; block?: boolean }) {
  try {
    return block
      ? <BlockMath math={tex} />
      : <InlineMath math={tex} />;
  } catch {
    return <code className="text-amber-300 text-xs">{tex}</code>;
  }
}

const templates = [
  {
    category: "Математический анализ",
    icon: Calculator,
    gradient: "from-blue-500 to-cyan-500",
    glow: "shadow-blue-500/20",
    border: "border-blue-500/30",
    bg: "bg-blue-500/5",
    tagColor: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    formulas: [
      { label: "Формула Ньютона–Лейбница", tex: "\\int_a^b f(x)\\,dx = F(b) - F(a)" },
      { label: "Первый замечательный предел", tex: "\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1" },
    ],
    items: [
      {
        title: "Вычислить определённый интеграл",
        description: "Шаблон с пошаговым решением и проверкой",
        template: `Предмет: Математический анализ
Тип: Вычислить определённый интеграл

Условие: $\\int_0^1 x^2 e^x \\, dx$

Требования:
- Метод интегрирования по частям ($\\int u\\,dv = uv - \\int v\\,du$)
- Расписать каждый шаг подробно
- Проверить ответ дифференцированием
- Формат: LaTeX, пошагово

Уровень: 2 курс бакалавриата`,
        tags: ["интеграл", "LaTeX", "матанализ"],
      },
      {
        title: "Найти предел функции",
        description: "Раскрытие неопределённости, правило Лопиталя",
        template: `Предмет: Математический анализ
Тип: Вычислить предел

Условие: $\\lim_{x \\to 0} \\dfrac{e^x - 1 - x}{x^2}$

Требования:
- Определить тип неопределённости (0/0, ∞/∞ и т.д.)
- Применить правило Лопиталя ИЛИ разложение Тейлора
- Записать формулы перед подстановкой
- Ответ в LaTeX`,
        tags: ["предел", "Лопиталь", "Тейлор"],
      },
    ],
  },
  {
    category: "Линейная алгебра",
    icon: Sigma,
    gradient: "from-violet-500 to-purple-600",
    glow: "shadow-violet-500/20",
    border: "border-violet-500/30",
    bg: "bg-violet-500/5",
    tagColor: "bg-violet-500/20 text-violet-300 border-violet-500/30",
    formulas: [
      { label: "Определитель 3×3 (Саррюс)", tex: "\\det A = \\sum_{\\sigma} \\text{sgn}(\\sigma)\\prod_{i} a_{i,\\sigma(i)}" },
      { label: "Нахождение обратной матрицы", tex: "A^{-1} = \\frac{1}{\\det A} \\cdot A^*" },
    ],
    items: [
      {
        title: "Решить СЛАУ методом Гаусса",
        description: "Система линейных уравнений с матричным решением",
        template: `Предмет: Линейная алгебра
Тип: Решение СЛАУ

Условие:
$\\begin{cases} 2x + y - z = 8 \\\\ -3x - y + 2z = -11 \\\\ -2x + y + 2z = -3 \\end{cases}$

Требования:
- Метод Гаусса (расширенная матрица)
- Показать каждую элементарную операцию
- Указать тип системы (совместная/несовместная/неопределённая)
- Ответ: $x = ?, y = ?, z = ?$`,
        tags: ["СЛАУ", "матрица", "Гаусс"],
      },
      {
        title: "Найти собственные значения матрицы",
        description: "Характеристическое уравнение и собственные векторы",
        template: `Предмет: Линейная алгебра
Тип: Собственные значения и векторы

Матрица:
$A = \\begin{pmatrix} 4 & 1 \\\\ 2 & 3 \\end{pmatrix}$

Требования:
- Характеристическое уравнение: $\\det(A - \\lambda I) = 0$
- Найти $\\lambda_1, \\lambda_2$
- Для каждого $\\lambda$ — найти собственный вектор $\\vec{v}$
- Формат LaTeX`,
        tags: ["собственные значения", "матрица"],
      },
    ],
  },
  {
    category: "Физика",
    icon: Atom,
    gradient: "from-sky-500 to-blue-600",
    glow: "shadow-sky-500/20",
    border: "border-sky-500/30",
    bg: "bg-sky-500/5",
    tagColor: "bg-sky-500/20 text-sky-300 border-sky-500/30",
    formulas: [
      { label: "Второй закон Ньютона", tex: "\\vec{F} = m\\vec{a}" },
      { label: "Закон сохранения энергии", tex: "E_k + E_p = \\text{const}" },
    ],
    items: [
      {
        title: "Задача по механике (кинематика)",
        description: "Движение тела с ускорением, формулы кинематики",
        template: `Предмет: Физика — Механика (кинематика)
Уровень: 1 курс / ЕГЭ

Условие: Тело брошено горизонтально с высоты $h = 20$ м со скоростью $v_0 = 10$ м/с. Найти дальность полёта и скорость при падении.

Дано:
$h = 20$ м, $v_0 = 10$ м/с, $g = 9{,}81$ м/с²

Найти: $x_{max}$, $v_{итог}$

Требования:
- Схема движения (текстовое описание)
- Формулы: $x = v_0 t$, $h = \\frac{g t^2}{2}$
- Вычисления в LaTeX
- Проверить размерность единиц`,
        tags: ["механика", "кинематика", "LaTeX"],
      },
      {
        title: "Задача по термодинамике",
        description: "Процессы идеального газа, уравнение Клапейрона",
        template: `Предмет: Физика — Термодинамика

Условие: Идеальный газ переходит из состояния 1 в состояние 2 при изобарном процессе. $T_1 = 300$ К, $V_1 = 2$ л, $T_2 = 600$ К.

Дано: $T_1, V_1, T_2$
Найти: $V_2$, работу $A$

Применить:
- Уравнение состояния: $PV = \\nu RT$
- Закон Гей-Люссака: $\\frac{V_1}{T_1} = \\frac{V_2}{T_2}$
- Работа газа: $A = P \\Delta V$`,
        tags: ["термодинамика", "газ", "Клапейрон"],
      },
    ],
  },
  {
    category: "Химия",
    icon: FlaskConical,
    gradient: "from-emerald-500 to-teal-500",
    glow: "shadow-emerald-500/20",
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/5",
    tagColor: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    formulas: [
      { label: "Молярная концентрация", tex: "C = \\frac{n}{V} = \\frac{m}{M \\cdot V}" },
      { label: "pH раствора", tex: "\\text{pH} = -\\log[\\text{H}^+]" },
    ],
    items: [
      {
        title: "Расставить коэффициенты (ОВР)",
        description: "Метод электронного баланса для окислительно-восстановительных реакций",
        template: `Предмет: Общая химия
Тип: Окислительно-восстановительная реакция

Уравнение: $KMnO_4 + HCl \\to KCl + MnCl_2 + Cl_2 + H_2O$

Требования:
- Определить степени окисления каждого элемента
- Составить электронный баланс (окислитель/восстановитель)
- Расставить коэффициенты методом электронного баланса
- Проверить атомы и заряды`,
        tags: ["ОВР", "баланс", "химия"],
      },
      {
        title: "Расчёт молярной концентрации",
        description: "Количественные расчёты в растворах",
        template: `Предмет: Химия — Растворы

Задача: Вычислить молярную концентрацию раствора $NaOH$, если в $250$ мл раствора растворено $4$ г $NaOH$.

Дано: $m = 4$ г, $V = 0{,}25$ л, $M(NaOH) = 40$ г/моль

Применить: $C = \\dfrac{m}{M \\cdot V}$

Требования:
- Вычисления с единицами измерения
- Ответ в моль/л
- Показать все промежуточные шаги`,
        tags: ["концентрация", "расчёт", "растворы"],
      },
    ],
  },
  {
    category: "Информатика",
    icon: Code2,
    gradient: "from-indigo-500 to-violet-500",
    glow: "shadow-indigo-500/20",
    border: "border-indigo-500/30",
    bg: "bg-indigo-500/5",
    tagColor: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
    formulas: [
      { label: "Сложность алгоритма", tex: "T(n) = O(n \\log n)" },
      { label: "Рекурсия через рекуррентность", tex: "T(n) = 2T(n/2) + O(n)" },
    ],
    items: [
      {
        title: "Разобрать и реализовать алгоритм",
        description: "Объяснение логики + рабочий код + анализ сложности",
        template: `Предмет: Алгоритмы и структуры данных
Язык: Python 3

Задача: Реализовать алгоритм сортировки слиянием (Merge Sort)

Требования:
- Пошаговое объяснение алгоритма «разделяй и властвуй»
- Рабочий код с подробными комментариями
- Анализ сложности: $T(n) = O(n \\log n)$
- Трассировка на примере: [5, 2, 8, 1, 9]
- Сравнить с пузырьковой сортировкой $O(n^2)$`,
        tags: ["алгоритм", "сортировка", "Python"],
      },
      {
        title: "SQL запрос для учебной БД",
        description: "Сложные SELECT, JOIN, агрегация",
        template: `Предмет: Базы данных / SQL

Задача: Написать запрос к базе данных сотрудников

Схема:
- Employees(id, name, dept_id, salary)
- Departments(id, name, manager_id)

Нужно: Вывести топ-3 отдела по средней зарплате с именем менеджера

Требования:
- Использовать JOIN, GROUP BY, HAVING, ORDER BY
- Объяснить каждую часть запроса
- Написать подзапрос и CTE-версию для сравнения`,
        tags: ["SQL", "JOIN", "БД"],
      },
    ],
  },
  {
    category: "Теория вероятностей и статистика",
    icon: TrendingUp,
    gradient: "from-amber-500 to-orange-500",
    glow: "shadow-amber-500/20",
    border: "border-amber-500/30",
    bg: "bg-amber-500/5",
    tagColor: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    formulas: [
      { label: "Формула Байеса", tex: "P(A|B) = \\frac{P(B|A) \\cdot P(A)}{P(B)}" },
      { label: "Математическое ожидание", tex: "M[X] = \\sum_{i} x_i p_i" },
    ],
    items: [
      {
        title: "Задача на формулу Байеса",
        description: "Условные вероятности и полная вероятность",
        template: `Предмет: Теория вероятностей
Уровень: 2–3 курс бакалавриата

Задача: На заводе 3 станка. Станок A выпускает 50% деталей (2% брака), B — 30% (4% брака), C — 20% (1% брака). Выбрана деталь с браком. Какова вероятность, что она с станка B?

Применить:
- Формула полной вероятности: $P(B_{бр}) = \\sum_i P(A_i) P(B_{бр}|A_i)$
- Формула Байеса: $P(A_B | B_{бр}) = \\dfrac{P(A_B)P(B_{бр}|A_B)}{P(B_{бр})}$

Требования: решение с формулами в LaTeX, числовой ответ`,
        tags: ["Байес", "вероятность", "LaTeX"],
      },
      {
        title: "Проверка статистической гипотезы",
        description: "t-критерий Стьюдента, уровень значимости",
        template: `Предмет: Математическая статистика

Задача: Выборка из 25 значений, $\\bar{x} = 105$, $s = 10$. Проверить гипотезу $H_0: \\mu = 100$ при $\\alpha = 0{,}05$.

Требования:
- Вычислить t-статистику: $t = \\dfrac{\\bar{x} - \\mu_0}{s/\\sqrt{n}}$
- Найти критическое значение $t_{кр}$ по таблице
- Вывод: принять/отвергнуть $H_0$
- Объяснить p-value`,
        tags: ["статистика", "гипотеза", "t-критерий"],
      },
    ],
  },
  {
    category: "Экономика",
    icon: BarChart2,
    gradient: "from-green-500 to-emerald-600",
    glow: "shadow-green-500/20",
    border: "border-green-500/30",
    bg: "bg-green-500/5",
    tagColor: "bg-green-500/20 text-green-300 border-green-500/30",
    formulas: [
      { label: "Формула дисконтирования", tex: "PV = \\frac{FV}{(1+r)^n}" },
      { label: "Эластичность спроса", tex: "E_d = \\frac{\\Delta Q / Q}{\\Delta P / P}" },
    ],
    items: [
      {
        title: "Расчёт NPV и IRR инвестпроекта",
        description: "Оценка инвестиционного проекта с денежными потоками",
        template: `Предмет: Финансовый менеджмент / Экономика предприятия

Условие: Инвестиции $I_0 = 100\\ 000$ руб., денежные потоки $CF_1 = 40\\ 000$, $CF_2 = 50\\ 000$, $CF_3 = 60\\ 000$ руб. Ставка дисконтирования $r = 10\\%$.

Найти: NPV, IRR, срок окупаемости

Формулы:
$NPV = -I_0 + \\sum_{t=1}^{n} \\dfrac{CF_t}{(1+r)^t}$

Требования: расчёт с таблицей, вывод о целесообразности проекта`,
        tags: ["NPV", "IRR", "инвестиции"],
      },
      {
        title: "Анализ точки безубыточности",
        description: "CVP-анализ, постоянные и переменные затраты",
        template: `Предмет: Управленческий учёт / Экономика

Данные: постоянные затраты $FC = 50\\ 000$ руб., цена $P = 200$ руб./шт., переменные затраты $VC = 120$ руб./шт.

Найти:
- Точку безубыточности: $Q^* = \\dfrac{FC}{P - VC}$
- Маржинальный доход $CM = P - VC$
- График (описание)
- Как изменится $Q^*$ при росте FC на 20%?`,
        tags: ["безубыточность", "CVP", "маржа"],
      },
    ],
  },
  {
    category: "Право",
    icon: Scale,
    gradient: "from-rose-500 to-red-600",
    glow: "shadow-rose-500/20",
    border: "border-rose-500/30",
    bg: "bg-rose-500/5",
    tagColor: "bg-rose-500/20 text-rose-300 border-rose-500/30",
    formulas: [],
    items: [
      {
        title: "Анализ правовой ситуации (казус)",
        description: "Структура юридической задачи: факты → нормы → вывод",
        template: `Предмет: [Гражданское / Трудовое / Уголовное право]
Уровень: бакалавриат юридического факультета

Фабула: [опишите ситуацию подробно — стороны, факты, спор]

Вопросы:
1. Нормы какого закона/кодекса применимы? (со статьями)
2. Каковы права и обязанности сторон?
3. Какое решение примет суд? Обоснуйте.

Требования:
- Цитировать статьи ГК/ТК/УК/иного кодекса
- Ссылаться на судебную практику (если есть)
- Структура: Факты → Правовая основа → Решение`,
        tags: ["казус", "кодекс", "юриспруденция"],
      },
      {
        title: "Составить договор / оценить условия",
        description: "Анализ договорных условий на соответствие закону",
        template: `Предмет: Гражданское право / Договорное право

Задача: Проанализировать условия договора [тип договора] и найти противоречия с законодательством.

Условия договора:
[вставьте текст пунктов договора]

Требования:
- Указать нарушения со ссылкой на статьи ГК РФ
- Предложить корректную формулировку
- Оценить риски для каждой из сторон`,
        tags: ["договор", "ГК РФ", "анализ"],
      },
    ],
  },
  {
    category: "Иностранный язык",
    icon: Globe,
    gradient: "from-cyan-500 to-sky-500",
    glow: "shadow-cyan-500/20",
    border: "border-cyan-500/30",
    bg: "bg-cyan-500/5",
    tagColor: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    formulas: [],
    items: [
      {
        title: "Академическое эссе (IELTS/TOEFL стиль)",
        description: "Структура: intro → body × 2 → conclusion",
        template: `Subject: Academic English Writing
Task type: Discursive Essay (for/against)

Topic: "Artificial intelligence will replace most human jobs within 20 years."

Word count: ~250 words
Style: Academic, formal

Requirements:
- Thesis statement in introduction
- 2 body paragraphs: 1 argument FOR, 1 argument AGAINST
- Topic sentences + evidence + analysis per paragraph
- Cohesion: use academic connectors (Furthermore, Nevertheless, etc.)
- Conclusion: restate thesis + balanced view`,
        tags: ["эссе", "IELTS", "Academic English"],
      },
      {
        title: "Перевод технического текста",
        description: "Технический или научный перевод с пояснениями",
        template: `Предмет: Технический перевод / Иностранный язык
Язык: [Английский / Немецкий / Французский / Китайский]

Текст для перевода:
[вставьте фрагмент текста]

Требования:
- Точный перевод без потери смысла
- Сохранить термины (с пояснением в скобках)
- Указать трудные места и варианты перевода
- Стиль: [научный / деловой / художественный]`,
        tags: ["перевод", "технический", "термины"],
      },
    ],
  },
  {
    category: "Биология и медицина",
    icon: Microscope,
    gradient: "from-lime-500 to-green-500",
    glow: "shadow-lime-500/20",
    border: "border-lime-500/30",
    bg: "bg-lime-500/5",
    tagColor: "bg-lime-500/20 text-lime-300 border-lime-500/30",
    formulas: [
      { label: "Закон Харди–Вайнберга", tex: "p^2 + 2pq + q^2 = 1" },
      { label: "Индекс массы тела", tex: "\\text{ИМТ} = \\frac{m}{h^2}" },
    ],
    items: [
      {
        title: "Задача по генетике (законы Менделя)",
        description: "Моногибридное и дигибридное скрещивание с расщеплением",
        template: `Предмет: Генетика / Биология
Уровень: ВУЗ или ЕГЭ

Задача: Гладкие семена (A) доминируют над морщинистыми (a). Скрестили Aa × Aa.

Требования:
- Решётка Пеннета (ASCII-таблица)
- Расщепление по фенотипу: 3 : 1
- Расщепление по генотипу: 1 AA : 2 Aa : 1 aa
- Вывод о доминировании/рецессивности
- Если дигибридное — 9:3:3:1`,
        tags: ["генетика", "Мендель", "биология"],
      },
      {
        title: "Описание физиологического процесса",
        description: "Механизм, уравнения, клиническое значение",
        template: `Предмет: Физиология / Биохимия
Тема: [Гликолиз / Фотосинтез / Нервный импульс / Иммунный ответ]

Требования:
- Пошаговый механизм процесса
- Уравнения химических реакций (если есть)
- Биологический смысл и роль в организме
- Клиническое значение / патологии при нарушении
- Уровень: [школа / бакалавриат / ординатура]`,
        tags: ["физиология", "биохимия", "механизм"],
      },
    ],
  },
  {
    category: "История и обществознание",
    icon: BookOpen,
    gradient: "from-orange-500 to-amber-500",
    glow: "shadow-orange-500/20",
    border: "border-orange-500/30",
    bg: "bg-orange-500/5",
    tagColor: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    formulas: [],
    items: [
      {
        title: "Анализ исторического события (ЕГЭ-формат)",
        description: "Причины → ход → последствия → оценки историков",
        template: `Предмет: История России / Всеобщая история
Формат: Развёрнутый ответ (ЕГЭ задание 24–25)

Событие: [название события, период]

Требования:
1. Причины (не менее 3, с историческим контекстом)
2. Основные события и деятели (даты!)
3. Итоги и исторические последствия
4. Оценки историков (2 точки зрения с аргументами)
5. Связь с современностью

Объём: 250–350 слов`,
        tags: ["история", "ЕГЭ", "анализ"],
      },
      {
        title: "Эссе по обществознанию",
        description: "Раскрытие цитаты с обществоведческими понятиями",
        template: `Предмет: Обществознание (ЕГЭ задание 29)

Цитата: "[вставьте цитату]"
Автор: [имя]

Структура эссе:
1. Смысл высказывания (своими словами)
2. Теоретическое обоснование (понятия, термины)
3. Аргумент из социальной жизни / истории
4. Аргумент из личного опыта / СМИ
5. Вывод

Требования: обществоведческие понятия, логика изложения`,
        tags: ["обществознание", "ЕГЭ", "эссе"],
      },
    ],
  },
  {
    category: "Эссе и гуманитарные тексты",
    icon: FileText,
    gradient: "from-pink-500 to-rose-500",
    glow: "shadow-pink-500/20",
    border: "border-pink-500/30",
    bg: "bg-pink-500/5",
    tagColor: "bg-pink-500/20 text-pink-300 border-pink-500/30",
    formulas: [],
    items: [
      {
        title: "Академическое эссе",
        description: "Структура с тезисом, аргументами и контраргументом",
        template: `Предмет: [название предмета]
Тип: Академическое эссе / Реферат

Тема: "[вставьте тему]"
Объём: ~[N] слов / [N] страниц
Стиль: академический / научно-популярный

Структура:
1. Введение + тезис (позиция автора)
2. Аргумент 1 + доказательство + пример
3. Аргумент 2 + доказательство + пример
4. Контраргумент + опровержение
5. Заключение

Источники: реальные, с годом издания`,
        tags: ["эссе", "академический текст"],
      },
      {
        title: "Рецензия / Аннотация",
        description: "Краткий обзор научной работы или книги",
        template: `Предмет: Научный стиль / Библиография
Тип: Рецензия / Аннотация

Работа: [название, автор, год]

Структура аннотации:
1. Тема и цель работы (1–2 предложения)
2. Методология / подход
3. Основные результаты
4. Научная значимость
5. Целевая аудитория

Объём аннотации: 150–250 слов
Стиль: нейтральный, безличный (используется, рассматривается...)`,
        tags: ["рецензия", "аннотация", "научный стиль"],
      },
    ],
  },
];

const tips = [
  {
    icon: Target,
    title: "Будьте конкретны",
    gradient: "from-violet-500 to-fuchsia-500",
    glow: "shadow-violet-500/30",
    border: "border-violet-500/30",
    text: "Чем точнее условие — тем точнее ответ. Укажите раздел, тему, данные и что нужно найти. Вставьте условие дословно.",
    good: "Найдите экстремумы f(x) = x³ - 3x² + 2, производной. Знаки f'(x) на числовой прямой. LaTeX-формат.",
    bad: "Помогите с математикой про экстремумы",
  },
  {
    icon: BookOpen,
    title: "Указывайте уровень и предмет",
    gradient: "from-blue-500 to-cyan-500",
    glow: "shadow-blue-500/30",
    border: "border-blue-500/30",
    text: "Ответ для первокурсника и магистранта — принципиально разные по глубине. Укажите курс, вуз, название дисциплины.",
    good: "Уровень: 2 курс, МГТУ, курс «Термодинамика». Нужен пошаговый расчёт с формулами.",
    bad: "Студент. Физика.",
  },
  {
    icon: BrainCircuit,
    title: "Используйте учебник как контекст",
    gradient: "from-emerald-500 to-teal-500",
    glow: "shadow-emerald-500/30",
    border: "border-emerald-500/30",
    text: "Загрузите PDF рекомендованного учебника — ИИ решит задачу точно в том формате и нотации, которые требует ваш преподаватель.",
    good: "Загружен учебник Сборник задач по термодинамике (Нащокин). ИИ оформит решение по образцу.",
    bad: "Просто спросить без учебника — ИИ не знает нужный стиль оформления",
  },
  {
    icon: AlertTriangle,
    title: "Вставляйте полное условие",
    gradient: "from-amber-500 to-orange-500",
    glow: "shadow-amber-500/30",
    border: "border-amber-500/30",
    text: "Обязательно — весь текст задачи, таблицы данных, единицы измерения, специальные условия. Неполное условие = неполный ответ.",
    good: "m = 2 кг, v₀ = 5 м/с, t = 3 с, μ = 0.3. Найти S — путь торможения по всем формулам кинематики.",
    bad: "Посчитайте путь если масса 2 кг и скорость",
  },
  {
    icon: CheckCircle2,
    title: "Просите формат LaTeX",
    gradient: "from-rose-500 to-pink-500",
    glow: "shadow-rose-500/30",
    border: "border-rose-500/30",
    text: "Для математики, физики и химии всегда добавляйте «формат LaTeX» — получите красиво оформленные формулы, которые можно вставить в Word или TeX.",
    good: "Вывести формулу и ответ в LaTeX: $\\int_0^1 x^2 dx = \\frac{1}{3}$",
    bad: "Просто написать «реши интеграл» — ответ в текстовом виде",
  },
];

// ─────────────────────────────────────────────────────────────
// TEMPLATE GENERATOR — works for ANY subject
// ─────────────────────────────────────────────────────────────
const TASK_TYPES = [
  { key: "solve",   label: "Решение задачи",        emoji: "🧮", desc: "Задача с числовыми данными, доказательство, вывод" },
  { key: "explain", label: "Объяснение темы",        emoji: "📖", desc: "Разбор понятия, теории или механизма" },
  { key: "essay",   label: "Написание работы",       emoji: "✍️", desc: "Реферат, эссе, курсовая, план работы" },
  { key: "code",    label: "Программирование / код", emoji: "💻", desc: "Код с объяснением и примером" },
  { key: "analyze", label: "Анализ текста",          emoji: "🔍", desc: "Разбор источника, документа, произведения" },
  { key: "exam",    label: "Подготовка к экзамену",  emoji: "🎯", desc: "Вопросы, шпаргалки, ключевые определения" },
];

const LEVELS = [
  { key: "school",   label: "Школа (7–11 класс)" },
  { key: "ege",      label: "ЕГЭ / ОГЭ" },
  { key: "college1", label: "ВУЗ — 1–2 курс" },
  { key: "college3", label: "ВУЗ — 3–4 курс" },
  { key: "master",   label: "Магистратура / аспирантура" },
];

function generateTemplate(subject: string, taskType: string, level: string, latex: boolean): string {
  const subj = subject.trim() || "Ваш предмет";
  const lvlLabel = LEVELS.find(l => l.key === level)?.label ?? "не указан";
  const latexLine = latex ? "\n- Формат формул: LaTeX ($$...$$)" : "";

  switch (taskType) {
    case "solve": return `Предмет: ${subj}
Тип: Решение задачи
Уровень: ${lvlLabel}

Условие:
[Вставьте полный текст задачи сюда]

Дано:
[Перечислите все числовые данные, единицы измерения]

Найти:
[Что нужно вычислить / доказать / найти]

Требования:
- Решить пошагово с объяснением каждого шага
- Указать используемые формулы и законы
- Проверить ответ (подстановкой / единицами измерения)${latexLine}
- Уровень объяснения: ${lvlLabel}`;

    case "explain": return `Предмет: ${subj}
Тип: Объяснение темы
Уровень: ${lvlLabel}

Тема: [Название понятия, раздела или теоремы]

Требования:
- Дать точное определение (академический стиль)
- Объяснить своими словами (доступно для уровня ${lvlLabel})
- Привести 2–3 конкретных примера
- Указать связь с другими темами курса${latexLine}
- Выделить типичные ошибки и заблуждения`;

    case "essay": return `Предмет: ${subj}
Тип: Академическая работа
Уровень: ${lvlLabel}

Тема: "[Вставьте тему работы]"
Объём: [~N страниц / слов]
Стиль: академический

Структура:
1. Введение — актуальность, цель, задачи
2. Теоретическая часть — понятия, подходы, литература
3. Основная часть — анализ, аргументы, примеры
4. Заключение — выводы, значимость
5. Список источников (ГОСТ Р 7.0.5-2008 или иной)

Требования:
- Научный стиль, без разговорных выражений
- Реальные источники (автор, год, издание)
- Логическая структура с переходами между разделами`;

    case "code": return `Предмет: ${subj}
Тип: Программирование
Уровень: ${lvlLabel}

Задача: [Опишите что нужно реализовать]
Язык: [Python / JavaScript / Java / C++ / SQL / другой]

Требования:
- Рабочий код с подробными комментариями
- Объяснение алгоритма / логики
- Пример входных и выходных данных
- Анализ сложности (если применимо)
- Обработка ошибок / крайних случаев
- Уровень: ${lvlLabel}`;

    case "analyze": return `Предмет: ${subj}
Тип: Анализ текста / источника
Уровень: ${lvlLabel}

Текст / источник:
[Вставьте фрагмент текста, цитату или ссылку]

Требования:
- Определить тип и жанр текста
- Выявить главную мысль и аргументы автора
- Критически оценить логику и достоверность
- Связать с контекстом курса «${subj}»
- Сформулировать собственный вывод
- Стиль ответа: ${lvlLabel}`;

    case "exam": return `Предмет: ${subj}
Тип: Подготовка к экзамену
Уровень: ${lvlLabel}

Раздел / тема: [Название темы или билета]

Что нужно:
1. Ключевые определения и понятия (сжато)
2. Главные формулы / теоремы / законы${latexLine}
3. Типовые задания и алгоритм их решения
4. Часто задаваемые вопросы на экзамене по данной теме
5. Самые распространённые ошибки студентов

Формат: структурированный список, легко читаемый`;

    default: return "";
  }
}

export default function HintsPage() {
  const { toast } = useToast();
  const { data: user } = useGetMe({ query: { retry: false } });
  const isGuest = !user;
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [customText, setCustomText] = useState("");
  const [activeTab, setActiveTab] = useState<"templates" | "tips" | "builder">("templates");
  const [searchQuery, setSearchQuery] = useState("");

  // Builder state
  const [builderSubject, setBuilderSubject] = useState("");
  const [builderTask, setBuilderTask] = useState("solve");
  const [builderLevel, setBuilderLevel] = useState("college1");
  const [builderLatex, setBuilderLatex] = useState(true);
  const [generatedTpl, setGeneratedTpl] = useState<string | null>(null);
  const [showChecker, setShowChecker] = useState(false);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({ title: "Шаблон скопирован!", description: "Вставьте его в поле описания задачи." });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return templates;
    return templates
      .map(cat => {
        const catMatch = cat.category.toLowerCase().includes(q);
        const filteredItems = cat.items.filter(item =>
          item.title.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q) ||
          item.tags.some(t => t.toLowerCase().includes(q)) ||
          item.template.toLowerCase().includes(q)
        );
        if (catMatch) return cat;
        if (filteredItems.length > 0) return { ...cat, items: filteredItems };
        return null;
      })
      .filter(Boolean) as typeof templates;
  }, [searchQuery]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Подсказки</h1>
          <p className="text-slate-400 mt-1">Готовые шаблоны для популярных предметов или создай свой — для любой дисциплины.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-amber-500/20 to-yellow-500/10 border border-amber-500/30 text-amber-300 text-sm font-medium">
          <Star className="w-4 h-4 text-amber-400" />
          Советы от команды
        </div>
      </div>

      {/* Guest CTA banner */}
      {isGuest && (
        <div className="rounded-2xl border border-violet-500/30 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 overflow-hidden">
          <div className="h-0.5 bg-gradient-to-r from-violet-500 to-fuchsia-500" />
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center shrink-0 shadow-lg shadow-violet-500/30">
                <Zap className="w-5 h-5 text-white" fill="currentColor" />
              </div>
              <div>
                <p className="font-bold text-white text-sm">Понравились примеры? Попробуйте решить свою задачу!</p>
                <p className="text-xs text-slate-400 mt-0.5">Зарегистрируйтесь за 30 секунд — 100 ₽ уже на балансе для первых задач</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link href="/login">
                <Button variant="outline" size="sm" className="border-white/20 text-slate-300 hover:text-white bg-white/5 hover:bg-white/10">
                  Войти
                </Button>
              </Link>
              <Link href="/register">
                <Button size="sm" className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 border-0 text-white font-bold shadow-[0_0_20px_rgba(139,92,246,0.4)]">
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Начать бесплатно
                  <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Search bar */}
      {activeTab === "templates" && (
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Поиск по предмету, шаблону или тегу..."
            className="pl-9 pr-9 bg-background/50 border-white/10 text-white placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      )}

      {/* Custom tab bar */}
      <div className="flex items-center gap-1 p-1 rounded-2xl bg-white/5 border border-white/10 w-full sm:w-auto">
        {[
          { key: "templates", label: "Готовые шаблоны", icon: MessageSquarePlus, gradient: "from-violet-500 to-fuchsia-500" },
          { key: "tips", label: "Советы и ошибки", icon: Lightbulb, gradient: "from-amber-500 to-orange-500" },
          { key: "builder", label: "Любой предмет", icon: Wand2, gradient: "from-emerald-500 to-teal-500" },
        ].map(({ key, label, icon: Icon, gradient }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as any)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
              activeTab === key
                ? `bg-gradient-to-r ${gradient} text-white shadow-lg`
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* TEMPLATES TAB */}
      {activeTab === "templates" && (
        <div className="space-y-12 animate-in fade-in duration-300">
          {filteredTemplates.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-lg font-medium text-white mb-1">Ничего не найдено</p>
              <p className="text-sm">Попробуйте другой запрос или{" "}
                <button onClick={() => setSearchQuery("")} className="text-primary hover:underline">сбросьте поиск</button>
              </p>
            </div>
          )}
          {filteredTemplates.map((cat) => (
            <div key={cat.category}>
              {/* Category header */}
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cat.gradient} flex items-center justify-center shadow-lg ${cat.glow}`}>
                  <cat.icon className="w-5 h-5 text-white" />
                </div>
                <h2 className="text-xl font-bold text-white">{cat.category}</h2>
              </div>

              {/* Inline formulas for this category */}
              {cat.formulas.length > 0 && (
                <div className="flex flex-wrap gap-3 mb-5 pl-[52px]">
                  {cat.formulas.map((f, fi) => (
                    <div key={fi} className={`flex items-center gap-3 px-4 py-2 rounded-xl border ${cat.border} ${cat.bg}`}>
                      <span className="text-xs text-slate-400 shrink-0">{f.label}:</span>
                      <span className="text-white text-sm">
                        <Formula tex={f.tex} />
                      </span>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {cat.items.map((item, i) => (
                  <div
                    key={i}
                    className={`rounded-2xl border ${cat.border} ${cat.bg} backdrop-blur-sm overflow-hidden hover:shadow-lg transition-all duration-300`}
                  >
                    <div className={`h-0.5 bg-gradient-to-r ${cat.gradient}`} />
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <h3 className="font-bold text-white text-base">{item.title}</h3>
                          <p className="text-sm text-slate-300 mt-0.5">{item.description}</p>
                        </div>
                        <button
                          onClick={() => handleCopy(item.template, `${cat.category}-${i}`)}
                          className={`shrink-0 w-9 h-9 rounded-xl border ${cat.border} flex items-center justify-center transition-all hover:bg-white/10 text-white`}
                        >
                          {copiedId === `${cat.category}-${i}` ? (
                            <CheckCheck className="w-4 h-4 text-green-400" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                      </div>

                      <div className="flex gap-1.5 flex-wrap mb-3">
                        {item.tags.map(t => (
                          <span key={t} className={`text-xs px-2.5 py-1 rounded-full border font-medium ${cat.tagColor}`}>{t}</span>
                        ))}
                      </div>

                      {/* Terminal code block */}
                      <div className="rounded-xl bg-black/50 border border-white/10 overflow-hidden">
                        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/10 bg-white/5">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                          <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                          <span className="ml-2 text-xs text-slate-500 font-mono">шаблон.txt</span>
                          <span className="ml-auto text-xs text-slate-600">LaTeX ✓</span>
                        </div>
                        <pre className="text-xs p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed font-mono text-slate-200">
                          {item.template}
                        </pre>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* TIPS TAB */}
      {activeTab === "tips" && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {tips.map((tip, i) => (
            <div
              key={i}
              className={`rounded-2xl border ${tip.border} bg-white/3 backdrop-blur-sm overflow-hidden hover:shadow-lg hover:${tip.glow} transition-all duration-300`}
            >
              <div className={`h-0.5 bg-gradient-to-r ${tip.gradient}`} />
              <div className="p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${tip.gradient} flex items-center justify-center shrink-0 shadow-lg ${tip.glow}`}>
                    <tip.icon className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white text-base mb-2">{i + 1}. {tip.title}</h3>
                    <p className="text-sm text-slate-300 leading-relaxed mb-4">{tip.text}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 p-4">
                        <div className="flex items-center gap-1.5 mb-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span className="text-xs font-bold text-emerald-400 tracking-wider uppercase">Хорошо</span>
                        </div>
                        <p className="text-sm text-white leading-relaxed">{tip.good}</p>
                      </div>
                      <div className="rounded-xl bg-red-500/10 border border-red-500/25 p-4">
                        <div className="flex items-center gap-1.5 mb-2">
                          <AlertTriangle className="w-4 h-4 text-red-400" />
                          <span className="text-xs font-bold text-red-400 tracking-wider uppercase">Плохо</span>
                        </div>
                        <p className="text-sm text-white leading-relaxed">{tip.bad}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* BUILDER TAB — any subject */}
      {activeTab === "builder" && (
        <div className="animate-in fade-in duration-300 space-y-6">

          {/* Header card */}
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 overflow-hidden">
            <div className="h-0.5 bg-gradient-to-r from-emerald-500 to-teal-500" />
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                  <Wand2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-white text-lg">Генератор для любого предмета</h2>
                  <p className="text-sm text-slate-300">Выберите тип задания и уровень — получите готовый шаблон запроса.</p>
                </div>
              </div>

              {/* Subject input */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white">Предмет / дисциплина</label>
                <Input
                  value={builderSubject}
                  onChange={e => { setBuilderSubject(e.target.value); setGeneratedTpl(null); }}
                  placeholder="Например: Философия, Педагогика, Строительство, Маркетинг..."
                  className="bg-black/30 border-white/15 text-white placeholder:text-slate-500"
                />
                <p className="text-xs text-slate-500">Любой предмет — школьный, вузовский, профессиональный</p>
              </div>

              {/* Task type grid */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white">Тип задания</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {TASK_TYPES.map(t => (
                    <button
                      key={t.key}
                      onClick={() => { setBuilderTask(t.key); setGeneratedTpl(null); }}
                      className={`text-left p-3 rounded-xl border transition-all ${
                        builderTask === t.key
                          ? "border-emerald-500/60 bg-emerald-500/15 text-white"
                          : "border-white/10 bg-white/3 text-slate-400 hover:border-white/25 hover:text-white"
                      }`}
                    >
                      <div className="text-lg mb-1">{t.emoji}</div>
                      <div className="text-xs font-semibold leading-snug">{t.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Level + LaTeX row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-white">Уровень</label>
                  <div className="flex flex-col gap-1.5">
                    {LEVELS.map(l => (
                      <button
                        key={l.key}
                        onClick={() => { setBuilderLevel(l.key); setGeneratedTpl(null); }}
                        className={`text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                          builderLevel === l.key
                            ? "border-emerald-500/60 bg-emerald-500/15 text-white font-medium"
                            : "border-white/10 bg-white/3 text-slate-400 hover:border-white/20 hover:text-white"
                        }`}
                      >
                        {l.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-white">Опции</label>
                  <button
                    onClick={() => { setBuilderLatex(!builderLatex); setGeneratedTpl(null); }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      builderLatex
                        ? "border-emerald-500/60 bg-emerald-500/15"
                        : "border-white/10 bg-white/3"
                    }`}
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                      builderLatex ? "border-emerald-400 bg-emerald-500" : "border-white/30"
                    }`}>
                      {builderLatex && <CheckCheck className="w-3 h-3 text-white" />}
                    </div>
                    <div className="text-left">
                      <div className={`text-sm font-medium ${builderLatex ? "text-white" : "text-slate-400"}`}>Формат LaTeX</div>
                      <div className="text-xs text-slate-500">Для математических формул</div>
                    </div>
                  </button>

                  <div className="rounded-xl border border-white/10 bg-white/3 p-3 mt-2">
                    <p className="text-xs text-slate-400 leading-relaxed">
                      <span className="text-emerald-400 font-semibold">Тип выбран:</span>{" "}
                      {TASK_TYPES.find(t => t.key === builderTask)?.desc}
                    </p>
                  </div>
                </div>
              </div>

              {/* Generate button */}
              <Button
                onClick={() => {
                  const tpl = generateTemplate(builderSubject, builderTask, builderLevel, builderLatex);
                  setGeneratedTpl(tpl);
                }}
                className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-0 shadow-lg shadow-emerald-500/25 font-semibold"
              >
                <Sparkles className="w-4 h-4 mr-2" /> Сгенерировать шаблон
              </Button>
            </div>
          </div>

          {/* Generated result */}
          {generatedTpl && (
            <div className="rounded-2xl border border-teal-500/30 bg-teal-500/5 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="h-0.5 bg-gradient-to-r from-teal-500 to-cyan-500" />
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-teal-400" />
                    <span className="font-bold text-white text-sm">Готовый шаблон</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 font-medium">
                      {builderSubject.trim() || "Предмет"} · {TASK_TYPES.find(t => t.key === builderTask)?.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-teal-500/40 text-teal-300 hover:bg-teal-500/10 hover:text-white"
                      onClick={() => {
                        navigator.clipboard.writeText(generatedTpl);
                        toast({ title: "Шаблон скопирован!", description: "Вставьте в поле «Новая задача» и заполните [скобки]." });
                      }}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1.5" /> Копировать
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-rose-500/40 text-rose-300 hover:bg-rose-500/10 hover:text-white"
                      onClick={async () => {
                        try {
                          const { exportHintsToPdf } = await import("@/lib/pdf-export");
                          await exportHintsToPdf({
                            subject: builderSubject.trim() || "Подсказки",
                            question: `Шаблон промпта · ${TASK_TYPES.find(t => t.key === builderTask)?.label || builderTask}`,
                            hints: generatedTpl,
                            createdAt: new Date().toISOString(),
                          });
                        } catch (e: any) {
                          toast({ title: "Ошибка экспорта", description: e?.message || "Не удалось создать PDF", variant: "destructive" });
                        }
                      }}
                    >
                      <FileText className="w-3.5 h-3.5 mr-1.5" /> PDF
                    </Button>
                  </div>
                </div>

                <div className="rounded-xl bg-black/50 border border-white/10 overflow-hidden">
                  <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/10 bg-white/5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                    <span className="ml-2 text-xs text-slate-500 font-mono">шаблон.txt</span>
                    <span className="ml-auto text-xs text-slate-600">скопируй → вставь → заполни [скобки]</span>
                  </div>
                  <pre className="text-xs p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed font-mono text-slate-200">
                    {generatedTpl}
                  </pre>
                </div>

                <p className="text-xs text-slate-500 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  Замените всё, что в [квадратных скобках], на реальные данные своей задачи
                </p>
              </div>
            </div>
          )}

          {/* Quality checker (collapsible) */}
          <div className="rounded-2xl border border-white/10 bg-white/3 overflow-hidden">
            <button
              className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors"
              onClick={() => setShowChecker(!showChecker)}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-semibold text-slate-300">Проверить свой готовый запрос</span>
              </div>
              {showChecker ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
            </button>
            {showChecker && (
              <div className="p-4 pt-0 space-y-3 animate-in fade-in duration-200">
                <div className="rounded-xl bg-black/40 border border-white/10 overflow-hidden">
                  <div className="flex items-center gap-1.5 px-3 py-2 border-b border-white/10 bg-white/5">
                    <span className="text-xs text-slate-500 font-mono">мой запрос.txt</span>
                  </div>
                  <Textarea
                    placeholder="Вставьте сюда ваше готовое условие задачи для проверки..."
                    className="min-h-[140px] bg-transparent border-0 font-mono text-sm text-slate-200 placeholder:text-slate-600 focus-visible:ring-0 resize-none"
                    value={customText}
                    onChange={e => setCustomText(e.target.value)}
                  />
                </div>
                {customText.length > 0 && (
                  <div className="space-y-2">
                    {[
                      { check: customText.length > 50, label: "Достаточная длина описания" },
                      { check: /предмет|subject|дисципл|математик|физик|хими|програм|python|java|экономик|прав|биолог|истор|философ|педаго|психо|архит|строи|медицин|юрид/i.test(customText), label: "Упомянут предмет / дисциплина" },
                      { check: /дано|условие|найти|задача|вычислить|решить|требования|найдите|докажите|объясн|разбер/i.test(customText), label: "Чёткая постановка задачи" },
                      { check: /\d/.test(customText), label: "Есть числа или конкретные данные" },
                      { check: /пошаго|шаг за шагом|объясн|подробн|формул|latex|LaTeX|код|пошагово|структур/i.test(customText), label: "Описан желаемый формат ответа" },
                      { check: /курс|уровень|бакалавр|магистр|школ|егэ|класс/i.test(customText), label: "Указан уровень образования" },
                    ].map((item, i) => (
                      <div key={i} className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-all ${item.check ? 'bg-emerald-500/10 border-emerald-500/25' : 'bg-white/5 border-white/10'}`}>
                        {item.check ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
                        <span className={`text-sm ${item.check ? 'text-white' : 'text-slate-400'}`}>{item.label}</span>
                        {item.check && <span className="ml-auto text-xs text-emerald-400 font-medium">✓</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
