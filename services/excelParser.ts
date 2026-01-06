
import { JiraTask } from '../types';

declare const XLSX: any;

const cleanStr = (val: any): string => {
  if (val === undefined || val === null) return '';
  return String(val).trim();
};

export const parseJiraExcel = async (file: File): Promise<JiraTask[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        // FORCE UTF-8: codepage: 65001 helps correctly decode Turkish characters in CSVs/Excel
        const workbook = XLSX.read(data, { type: 'array', codepage: 65001 });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        // Map Jira standard columns to our internal format
        const tasks: JiraTask[] = jsonData.map((row: any) => {
          return {
            // Priority checks for Backlog ID
            backlogId: cleanStr(row['Inward issue link (Relates)_1'] || row['Inward issue link (Relates)'] || row['Issue key'] || row['Key'] || 'N/A'),
            
            // Priority checks for Summary
            summary: cleanStr(row['Summary'] || row['Özet'] || 'N/A'),
            
            // Priority checks for Epic Name
            epicName: cleanStr(row['Parent summary'] || row['Parent Summary'] || row['Custom field (Epic Name)'] || row['Epic Link'] || row['Epic Name'] || 'No Epic'),
            
            // Fix Version
            fixVersion: cleanStr(row['Fix Version/s'] || row['Fix version/s'] || row['Sürüm'] || 'Unscheduled'),
            
            // Fix Build
            fixBuild: cleanStr(row['Custom field (Fix Build)'] || row['Fix Build'] || row['Build'] || 'General'),
            
            // Status
            status: cleanStr(row['Status'] || row['Durum'] || 'Unknown'),
            
            // Original Key for Platform Detection
            originalKey: cleanStr(row['Issue key'] || row['Key']),

            // Status Category Changed
            statusCategoryChanged: cleanStr(row['Status Category Changed'] || row['Statü Değişim Tarihi'] || row['Updated'] || '')
          };
        });

        resolve(tasks);
      } catch (err) {
        console.error(err);
        reject(new Error("Dosya ayrıştırılamadı. Lütfen Jira'dan alınmış geçerli bir Excel veya CSV dosyası yükleyin."));
      }
    };
    reader.onerror = () => reject(new Error("Dosya okuma hatası."));
    reader.readAsArrayBuffer(file);
  });
};
