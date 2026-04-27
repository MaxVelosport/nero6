import { Router } from "express";

const router = Router();

router.get("/plans", (_req, res) => {
  res.json({
    fast: {
      name: "Быстрый",
      description: "Два дешёвых ИИ решают задачу параллельно, Gemini синтезирует лучший ответ.",
      priceFrom: 5,
      timeFrom: 2,
      timeTo: 5,
      models: ["DeepSeek-V3", "GPT-4o-mini", "Gemini 2.0 Flash"],
      features: [
        "DeepSeek-V3 + GPT-4o-mini параллельно",
        "Gemini 2.0 Flash синтезирует ответ",
        "Markdown-вывод с формулами",
        "Диаграммы Mermaid и интерактивные графики",
        "Быстрее сложных режимов",
      ],
      recommended: false,
    },
    standard: {
      name: "Стандарт",
      description: "Три топовых ИИ решают параллельно, Gemini выбирает лучшее. Оптимально для большинства задач.",
      priceFrom: 15,
      timeFrom: 4,
      timeTo: 8,
      models: ["DeepSeek-V3", "GPT-4o", "Claude Sonnet", "Gemini 2.0 Flash"],
      features: [
        "DeepSeek-V3 + GPT-4o + Claude Sonnet",
        "Gemini Flash синтезирует финальный ответ",
        "Перекрёстная проверка трёх решений",
        "Пошаговое структурированное решение",
        "LaTeX-формулы, диаграммы, интерактивные графики",
        "Генерация изображений DALL-E 3 (8 ₽/шт)",
      ],
      recommended: true,
    },
    premium: {
      name: "Премиум",
      description: "Мощные reasoning-модели параллельно, Claude Sonnet синтезирует итог. Сложные задачи и курсовые.",
      priceFrom: 25,
      timeFrom: 6,
      timeTo: 12,
      models: ["DeepSeek-R1", "GPT-4o", "Gemini 2.5 Pro", "Claude Sonnet"],
      features: [
        "DeepSeek-R1 (рассуждатель) параллельно",
        "GPT-4o + Gemini 2.5 Pro параллельно",
        "Claude Sonnet синтезирует финальный ответ",
        "Высокая точность и глубина анализа",
        "Для курсовых, лабораторных, расчётов",
        "ГОСТ-структура и полные пояснения",
        "Диаграммы UML/ER, графики, DALL-E изображения",
      ],
      recommended: false,
    },
    super_premium: {
      name: "Супер Премиум",
      description: "Максимум: те же топ-воркеры, но Claude Opus финализирует. Дипломные, сложнейшие задачи.",
      priceFrom: 89,
      timeFrom: 10,
      timeTo: 20,
      models: ["DeepSeek-R1", "GPT-4o", "Gemini 2.5 Pro", "Claude Opus"],
      features: [
        "DeepSeek-R1 + GPT-4o + Gemini 2.5 Pro",
        "Claude Opus — лучший синтезатор в мире",
        "Наивысшее качество финального ответа",
        "Для дипломных и самых сложных работ",
        "Глубокий анализ + полные пояснения",
        "ГОСТ-структура, цитаты, библиография",
        "Полная визуализация: диаграммы, графики, изображения",
      ],
      recommended: false,
    },
    image_generation: {
      name: "Генерация изображений",
      description: "DALL-E 3 создаёт академические иллюстрации по текстовому описанию.",
      priceFrom: 8,
      costRub: 3.6,
      margin: "55%",
      features: [
        "DALL-E 3 — лучшая модель OpenAI для изображений",
        "Разрешение 1024×1024 пикселей",
        "Академический стиль и высокое качество",
        "Схемы, графики, диаграммы, иллюстрации",
        "Доступно в задачах, чате и научных работах",
      ],
    },
  });
});

export default router;
