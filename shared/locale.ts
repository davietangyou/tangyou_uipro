import { Converter } from 'opencc-js/cn2t';

const convert = Converter({ from: 'cn', to: 'hk' });
const productVariants: Record<string, string> = { '説': '說', '牀': '床', '户': '戶' };

/** Product/AI prose only: never rewrite user input or persisted historical data. */
export function toHongKongChinese(text: string): string {
  // Keep code and URL destinations intact when formatting an AI Markdown reply.
  return text.split(/(```[\s\S]*?```|`[^`\n]*`|https?:\/\/[^\s<>）)]+)/g)
    .map((part, index) => index % 2 ? part : convert(part)
      .replace(/[説牀户]/g, character => productVariants[character]).replace(/瞭解/g, '了解'))
    .join('');
}

/** A comparison key, not a replacement for the original saved question. */
export const questionComparisonKey = (text: string) =>
  toHongKongChinese(text).trim().replace(/\s+/g, ' ');
