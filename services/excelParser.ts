
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
          
          // Original Key (e.g. ISCEPANDROID-1234)
          const originalKey = cleanStr(row['Inward issue link (Relates)_1'] || row['Inward issue link (Relates)'] || row['Issue key'] || row['Key'] || 'N/A');
          
          // Issue Type extraction
          const issueType = cleanStr(row['Issue Type'] || row['Issue type'] || row['Sorun Tipi'] || 'Story');

          // --- LINKED ISSUES LOGIC UPDATE ---
          // Jira CSV exports split links into many columns (e.g. 'Inward issue link (Relates)', 'Outward issue link (Cloners)').
          // Instead of guessing column names, we scan all values in the row for the ID patterns.
          const allRowValues = Object.values(row).map(v => String(v)).join(' ');

          // Backlog ID Logic (CCRSP)
          let backlogId = '-';
          const ccrspMatch = allRowValues.match(/(CCRSP-\d+)/);
          if (ccrspMatch) {
            backlogId = ccrspMatch[0];
          }

          // External RC ID Logic (ISCEPEXTRC)
          let externalRcId = '-';
          const extRcMatch = allRowValues.match(/(ISCEPEXTRC-\d+)/);
          if (extRcMatch) {
            externalRcId = extRcMatch[0];
          }

          return {
            backlogId: backlogId,
            
            summary: cleanStr(row['Summary'] || row['Özet'] || 'N/A'),
            
            epicName: cleanStr(row['Parent summary'] || row['Parent Summary'] || row['Custom field (Epic Name)'] || row['Epic Link'] || row['Epic Name'] || 'No Epic'),
            
            fixVersion: cleanStr(row['Fix Version/s'] || row['Fix version/s'] || row['Sürüm'] || 'Unscheduled'),
            
            // Updated to check 'Custom field (Fix Build #)' which is common in CSV exports
            fixBuild: cleanStr(row['Custom field (Fix Build #)'] || row['Custom field (Fix Build)'] || row['Fix Build'] || row['Build'] || 'General'),
            
            status: cleanStr(row['Status'] || row['Durum'] || 'Unknown'),
            
            // Keep original key for platform detection logic (ISCEPANDROID etc.)
            originalKey: originalKey,

            statusCategoryChanged: cleanStr(row['Status Category Changed'] || row['Statü Değişim Tarihi'] || row['Updated'] || ''),

            issueType: issueType,
            externalRcId: externalRcId
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