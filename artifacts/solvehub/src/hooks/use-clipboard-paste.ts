import { useEffect } from "react";

type PasteHandler = (files: File[]) => void;

/**
 * Слушает Ctrl+V / Cmd+V в документе.
 * Если в буфере есть изображения — вызывает onPaste с массивом File.
 * Работает только когда enabled === true (по умолчанию true).
 */
export function useClipboardPaste(onPaste: PasteHandler, enabled = true) {
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      const files: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === "file") {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }

      if (files.length > 0) {
        e.preventDefault();
        onPaste(files);
      }
    };

    document.addEventListener("paste", handler);
    return () => document.removeEventListener("paste", handler);
  }, [onPaste, enabled]);
}
