
import { GoogleGenAI } from "@google/genai";
import { JiraTask } from "../types";

export const generateReleaseSummary = async (version: string, build: string, tasks: JiraTask[]): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Create a markdown table representation for the tasks
  const taskRows = tasks.map(t => `| ${t.backlogId} | ${t.epicName} | ${t.summary} |`).join('\n');
  const today = new Date().toLocaleDateString('tr-TR');
  
  const prompt = `
    Aşağıdaki verileri kullanarak kurumsal bir "Sürüm Notu" e-posta taslağı oluştur.
    Çıktı tam olarak aşağıdaki şablona uymalıdır. Köşeli parantez içindeki alanları doldur, diğer yer tutucuları (placeholder) manuel giriş için boş bırak.

    GİRDİ VERİLERİ:
    Tarih: ${today}
    Sürüm: ${version}
    Build: ${build}
    Platform: (Genel)
    
    GÖREV LİSTESİ (TALEPLER):
    ${taskRows}

    İSTENEN ÇIKTI FORMATI (Aynen bu yapıyı koru):

    KISIM A - Sürüm Bilgileri
    ----------------------------------------------------------------
    1 - Proje Bilgileri
    Tarih: ${today}
    Proje Bilgisi: İşCep Projesi
    Sürüm Bilgisi: ${version} (Build: ${build})
    Platform: IOS / Android / Genel

    2 - Sürüm Özeti
    ----------------------------------------------------------------
    
    TALEPLER
    | Backlog ID | Epic Name | Açıklama |
    |------------|-----------|----------|
    ${taskRows}

    TAMAMLANAN KAYITLAR
    (Bu alan manuel doldurulacaktır. Örnek: Defect ID | Açıklama)
    | Defect ID | Açıklama |
    |-----------|----------|
    |           |          |
    |           |          |

    KISIM B - Sürüm Detayları
    ----------------------------------------------------------------
    1. Belirtilmesi Gerekenler:
    - ${version} paketidir.
    - (Manuel eklenecek notlar...)

    2. Bilinen Durumlar:
    | Defect ID | Açıklama |
    |-----------|----------|
    |           |          |

    KISIM C - Paket Detayları
    ----------------------------------------------------------------
    Dokümanda iletilen geliştirmeleri test edebileceğiniz paket linki:
    
    Paket Bilgileri:
    Link: (Manuel eklenecek)
    Tarih: (Manuel eklenecek)
    Hash/ID: (Manuel eklenecek)

    Not: Bu taslak Markdown tablosu formatındadır. Kopyalayıp Excel'e veya destekleyen bir mail editörüne yapıştırabilirsiniz.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "Rapor taslağı oluşturulamadı.";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Yapay zeka raporu oluşturulurken bir hata oluştu.";
  }
};
