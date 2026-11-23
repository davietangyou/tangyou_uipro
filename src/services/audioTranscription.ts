import { GoogleGenAI } from "@google/genai";

// 由舊 services/geminiService.ts 提取的最小轉寫路徑。
// 保留既有前端 @google/genai 直連方式，以及 index.tsx 的 Gemini host 改寫攔截器。
const getApiKey = () => {
  try {
    return process.env.GEMINI_API_KEY || "";
  } catch {
    return "";
  }
};

const ai = new GoogleGenAI({
  apiKey: getApiKey(),
});

export async function transcribeAudio(base64Audio: string, mimeType: string): Promise<string> {
  const model = "gemini-3.5-flash";
  const prompt = "你是一個語音輸入法助手。請將這段錄音準確地轉換為繁體中文（廣東話）。請只返回聽寫出的文字內容，不要包含任何額外的解釋、旁白或標點。";

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          inlineData: {
            mimeType: mimeType,
            data: base64Audio,
          },
        },
        prompt,
      ],
    });

    return response.text?.trim() || "";
  } catch (error) {
    console.error("transcribeAudio error:", error);
    throw error;
  }
}