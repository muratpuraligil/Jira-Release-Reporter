
/// <reference types="vite/client" />
import { GoogleGenAI } from "@google/genai";
import { JiraTask } from "../types";

export async function generateReleaseSummary(tasks: JiraTask[]): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  
  if (!apiKey) {
    throw new Error("Gemini API anahtarı bulunamadı. Lütfen .env dosyasını kontrol edin.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Aşağıdaki Jira kayıtlarına göre profesyonel bir sürüm özeti oluştur.
    Özet, yeni eklenen özellikleri ve düzeltilen hataları içermelidir.
    
    Kayıtlar:
    ${JSON.stringify(tasks, null, 2)}
  `;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: prompt,
  });

  return response.text || "Özet oluşturulamadı.";
}
