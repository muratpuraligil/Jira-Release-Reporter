
import React, { useState, useMemo, useRef } from 'react';
import { 
  FileUp, 
  Copy, 
  LayoutDashboard, 
  AlertCircle,
  FileText,
  History,
  Trash2,
  Filter,
  XCircle,
  CalendarClock,
  Smartphone,
  MonitorSmartphone,
  CheckCircle2,
  UploadCloud
} from 'lucide-react';
import { parseJiraExcel } from './services/excelParser';
import { parseJiraHtml } from './services/htmlParser';
import { JiraTask, ReportStatus } from './types';

const App: React.FC = () => {
  const [tasks, setTasks] = useState<JiraTask[]>([]);
  const [status, setStatus] = useState<ReportStatus>(ReportStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  
  // Filtering & Notifications
  const [filterCutoffTimestamp, setFilterCutoffTimestamp] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const reportRef = useRef<HTMLDivElement>(null);

  // Handle File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus(ReportStatus.LOADING);
    setError(null);
    setFilterCutoffTimestamp(null); 
    setSuccessMessage(null);

    try {
      let parsedTasks: JiraTask[] = [];

      // Detect file type and choose parser
      if (file.name.toLowerCase().endsWith('.html') || file.name.toLowerCase().endsWith('.htm')) {
        parsedTasks = await parseJiraHtml(file);
      } else {
        // Default to Excel/CSV parser
        parsedTasks = await parseJiraExcel(file);
      }

      setTasks(parsedTasks);
      setStatus(ReportStatus.LOADED);
    } catch (err: any) {
      setError(err.message);
      setStatus(ReportStatus.ERROR);
    }
  };

  // --- Helper: Robust Date Parser for Jira Formats ---
  const parseJiraDate = (dateStr: string): number => {
    if (!dateStr) return 0;
    
    // Normalize spaces: replace non-breaking spaces and multiple spaces with a single space
    // We do NOT remove non-ascii characters to support Turkish months (Kas, Ağu, Şub etc.)
    const clean = dateStr.trim().replace(/\s+/g, ' ');

    // 1. Try Specific Jira Format with Time: "28/Nov/25 3:39 PM" or "28/Kas/25 03:39 ÖS"
    // Supports separators: / - .
    const regex = /^(\d{1,2})[\/\-\.]([A-Za-zĞÜŞİÖÇğüşıöç]{3})[\/\-\.](\d{2,4})\s+(\d{1,2}):(\d{2})\s+(AM|PM|ÖÖ|ÖS)$/i;
    const match = clean.match(regex);

    if (match) {
      const [, dayStr, monthStr, yearStr, hourStr, minStr, ampmStr] = match;
      
      const monthMap: { [key: string]: number } = {
        // English
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
        // Turkish
        oca: 0, sub: 1, şub: 1, mar: 2, nis: 3, may: 4, haz: 5,
        tem: 6, agu: 7, ağu: 7, eyl: 8, eki: 9, kas: 10, ara: 11
      };

      const month = monthMap[monthStr.toLowerCase()];
      if (month === undefined) return 0; // Invalid month

      let hour = parseInt(hourStr, 10);
      const minute = parseInt(minStr, 10);
      
      let year = parseInt(yearStr, 10);
      if (year < 100) year += 2000; // Handle 2-digit years

      const ampm = ampmStr.toUpperCase();
      const isPm = ampm === 'PM' || ampm === 'ÖS';
      const isAm = ampm === 'AM' || ampm === 'ÖÖ';

      // Convert 12h to 24h
      if (isPm && hour < 12) hour += 12;
      if (isAm && hour === 12) hour = 0;

      // Use local time construction to match Date.parse behavior
      return new Date(year, month, parseInt(dayStr, 10), hour, minute).getTime();
    }

    // 2. Fallback for Simple Date "28/Nov/25" (No time)
    const simpleRegex = /^(\d{1,2})[\/\-\.]([A-Za-zĞÜŞİÖÇğüşıöç]{3})[\/\-\.](\d{2,4})$/i;
    const simpleMatch = clean.match(simpleRegex);
    if (simpleMatch) {
       const [, dayStr, monthStr, yearStr] = simpleMatch;
       const monthMap: { [key: string]: number } = {
        jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
        jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
        oca: 0, sub: 1, şub: 1, mar: 2, nis: 3, may: 4, haz: 5,
        tem: 6, agu: 7, ağu: 7, eyl: 8, eki: 9, kas: 10, ara: 11
      };
      const month = monthMap[monthStr.toLowerCase()];
      if (month !== undefined) {
         let year = parseInt(yearStr, 10);
         if (year < 100) year += 2000;
         return new Date(year, month, parseInt(dayStr, 10)).getTime();
      }
    }

    // 3. Fallback to standard JS parsing
    // Replace slashes/dots with spaces for better parsing compatibility
    const safeStr = clean.replace(/[\/\-\.]/g, ' ');
    const timestamp = Date.parse(safeStr);
    return isNaN(timestamp) ? 0 : timestamp;
  };

  // --- Derived State Logic ---

  // Helper to check if task is approved/passed
  const isApproved = (t: JiraTask) => 
    t.status.toLowerCase().includes('approved') || 
    t.status.toLowerCase().includes('onay') || 
    t.status.toLowerCase().includes('test passed');

  // Helper: Check if a task is "Hidden/Old" based on filter
  const isTaskHidden = (t: JiraTask): boolean => {
    if (filterCutoffTimestamp === null) return false;
    const tDate = parseJiraDate(t.statusCategoryChanged);
    // If task date is OLDER or EQUAL to cutoff, it is hidden (grayed out)
    return tDate <= filterCutoffTimestamp;
  };

  // 1. Filter Tasks (Shows ALL approved tasks in UI, styling handles the hiding)
  const filteredTasks = useMemo(() => {
    // Only filter by Status (Approved/Passed)
    // We do NOT filter by date here anymore, so we can show them as grayed out
    let result = tasks.filter(isApproved);

    // Sort by Epic Name
    return result.sort((a, b) => (a.epicName || '').localeCompare(b.epicName || ''));
  }, [tasks]); // Removed filterCutoffTimestamp dependency for the list content

  // 2. History View Tasks (Shows ALL approved tasks regardless of filter, sorted NEWEST first)
  const historyViewTasks = useMemo(() => {
    const approved = tasks.filter(isApproved);
    return approved.sort((a, b) => {
      const dateA = parseJiraDate(a.statusCategoryChanged);
      const dateB = parseJiraDate(b.statusCategoryChanged);
      return dateB - dateA; // Descending (Newest first)
    });
  }, [tasks]);

  // 3. Platform Detection
  const detectedPlatform = useMemo(() => {
    const keys = tasks.map(t => t.originalKey ? t.originalKey.toUpperCase() : '');
    if (keys.some(k => k.includes('ISCEPANDROID'))) return 'ANDROID';
    if (keys.some(k => k.includes('ISCEPIPHONE'))) return 'IOS';
    return 'IOS'; // Default
  }, [tasks]);

  // 4. Version Detection (Must EXCLUDE hidden tasks)
  const displayVersion = useMemo(() => {
    const activeTasks = filteredTasks.filter(t => !isTaskHidden(t));

    const allBuilds = activeTasks
      .map(t => t.fixBuild)
      .flatMap(fb => fb.split(',').map(s => s.trim()))
      .filter(b => b.length > 0);
    
    const fourDigitRegex = /^\d+\.\d+\.\d+\.\d+$/;
    const validBuilds = allBuilds.filter(b => fourDigitRegex.test(b));

    if (validBuilds.length === 0) return '-';

    validBuilds.sort((a, b) => {
      const partsA = a.split('.').map(Number);
      const partsB = b.split('.').map(Number);
      for (let i = 0; i < 4; i++) {
        if (partsA[i] > partsB[i]) return -1; 
        if (partsA[i] < partsB[i]) return 1;
      }
      return 0;
    });

    return validBuilds[0];
  }, [filteredTasks, filterCutoffTimestamp]);

  // Helper to calculate rowSpan for Epics
  const getEpicRowSpan = (taskIndex: number) => {
    const currentTask = filteredTasks[taskIndex];
    if (taskIndex > 0 && filteredTasks[taskIndex - 1].epicName === currentTask.epicName) {
      return 0;
    }
    let span = 1;
    for (let i = taskIndex + 1; i < filteredTasks.length; i++) {
      if (filteredTasks[i].epicName === currentTask.epicName) {
        span++;
      } else {
        break;
      }
    }
    return span;
  };

  // --- ACTIONS ---

  const handleDateFilter = (dateStr: string) => {
    const timestamp = parseJiraDate(dateStr);
    
    if (timestamp > 0) {
      if (window.confirm(`${dateStr} tarihli ve öncesindeki tüm kayıtlar griye boyanacak (pasif yapılacak).\n\nSadece bu tarihten sonra (daha yeni) olan kayıtlar aktif kalacak.\n\nOnaylıyor musunuz?`)) {
        
        // Calculate count
        const currentlyActive = tasks.filter(t => isApproved(t) && (filterCutoffTimestamp === null || parseJiraDate(t.statusCategoryChanged) > filterCutoffTimestamp));
        const futureActive = tasks.filter(t => isApproved(t) && parseJiraDate(t.statusCategoryChanged) > timestamp);
        
        const hiddenCount = currentlyActive.length - futureActive.length;

        setFilterCutoffTimestamp(timestamp);
        setSuccessMessage(`${hiddenCount} adet kayıt pasife alındı (gri yapıldı).`);
        
        // Auto-dismiss success message
        setTimeout(() => setSuccessMessage(null), 5000);
        
        // Scroll to top to see report
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else {
      alert(`Tarih formatı algılanamadı: "${dateStr}". Lütfen dosyanızın Jira standart formatında olduğundan emin olun.`);
    }
  };

  const clearDateFilter = () => {
    setFilterCutoffTimestamp(null);
    setSuccessMessage(null);
  };

  const handleCopyToEmail = () => {
    if (!reportRef.current) return;
    const today = new Date().toLocaleDateString('tr-TR');
    
    // Active tasks only for email
    const activeTasks = filteredTasks.filter(t => !isTaskHidden(t));
    
    // Styles
    const borderStyle = 'border: 1px solid black; border-collapse: collapse; padding: 5px; font-family: Calibri, sans-serif; font-size: 11pt; vertical-align: top;';
    const headerBlue = 'background-color: #0052cc; color: white; font-weight: bold; vertical-align: middle;';
    const bgGray = 'background-color: #f2f2f2; font-weight: bold; vertical-align: middle;';
    
    // Generate Task Rows
    let tasksRows = '';
    
    // We need to re-calculate rowspans specifically for the active list
    const getActiveEpicRowSpan = (taskIndex: number, list: JiraTask[]) => {
        const currentTask = list[taskIndex];
        if (taskIndex > 0 && list[taskIndex - 1].epicName === currentTask.epicName) {
          return 0;
        }
        let span = 1;
        for (let i = taskIndex + 1; i < list.length; i++) {
          if (list[i].epicName === currentTask.epicName) {
            span++;
          } else {
            break;
          }
        }
        return span;
    };
    
    for (let i = 0; i < activeTasks.length; i++) {
      const t = activeTasks[i];
      const rowSpan = getActiveEpicRowSpan(i, activeTasks);

      let epicCell = '';
      if (rowSpan > 0) {
        epicCell = `<td rowspan="${rowSpan}" style="${borderStyle} vertical-align: middle; background-color: #ffffff;">${t.epicName}</td>`;
      }

      tasksRows += `
      <tr>
        <td style="${borderStyle}">
          <a href="https://commencis.atlassian.net/browse/${t.backlogId}" style="color: blue; text-decoration: underline;">${t.backlogId}</a>
        </td>
        ${epicCell} 
        <td style="${borderStyle}">${t.summary}</td>
      </tr>`;
    }

    const completedRows = `
      <tr><td style="${borderStyle} height: 20px;">&nbsp;</td><td colspan="2" style="${borderStyle}">&nbsp;</td></tr>
      <tr><td style="${borderStyle} height: 20px;">&nbsp;</td><td colspan="2" style="${borderStyle}">&nbsp;</td></tr>
      <tr><td style="${borderStyle} height: 20px;">&nbsp;</td><td colspan="2" style="${borderStyle}">&nbsp;</td></tr>
    `;

    const htmlContent = `
      <table style="width: 100%; border-collapse: collapse; font-family: Calibri, sans-serif;">
        <colgroup>
           <col style="width: 15%;"> 
           <col style="width: 25%;">
           <col style="width: 60%;">
        </colgroup>
        <!-- KISIM A -->
        <tr>
          <td style="${borderStyle} ${headerBlue}">KISIM A</td>
          <td colspan="2" style="${borderStyle} ${headerBlue}">Sürüm Bilgileri</td>
        </tr>
        <tr>
          <td style="${borderStyle} ${bgGray}">1 - Proje Bilgileri</td>
          <td style="${borderStyle} ${bgGray}">Tarih:</td>
          <td style="${borderStyle} text-align: left;">${today}</td>
        </tr>
        <tr>
          <td style="${borderStyle}">&nbsp;</td>
          <td style="${borderStyle} ${bgGray}">Proje Bilgisi:</td>
          <td style="${borderStyle}">İşCep Projesi</td>
        </tr>
        <tr>
          <td style="${borderStyle}">&nbsp;</td>
          <td style="${borderStyle} ${bgGray}">Sürüm Bilgisi:</td>
          <td style="${borderStyle}">${displayVersion}</td>
        </tr>
        <tr>
          <td style="${borderStyle}">&nbsp;</td>
          <td style="${borderStyle} ${bgGray}">Platform:</td>
          <td style="${borderStyle}">${detectedPlatform}</td>
        </tr>
        <tr><td colspan="3" style="height: 10px;"></td></tr>

        <!-- TALEPLER -->
        <tr>
          <td colspan="3" style="${borderStyle} ${headerBlue} text-align: center;">Talepler</td>
        </tr>
        <tr>
          <td style="${borderStyle} ${bgGray}">Backlog ID</td>
          <td style="${borderStyle} ${bgGray}">Epic Name</td>
          <td style="${borderStyle} ${bgGray}">Açıklama</td>
        </tr>
        ${tasksRows}
        <tr><td colspan="3" style="height: 10px;"></td></tr>

        <!-- TAMAMLANAN KAYITLAR -->
        <tr>
          <td colspan="3" style="${borderStyle} ${headerBlue} text-align: center;">Tamamlanan Kayıtlar</td>
        </tr>
        <tr>
          <td style="${borderStyle} ${bgGray}">Defect ID</td>
          <td colspan="2" style="${borderStyle} ${bgGray}">Açıklama</td>
        </tr>
        ${completedRows}
        <tr><td colspan="3" style="height: 10px;"></td></tr>

        <!-- KISIM B -->
        <tr>
          <td style="${borderStyle} ${headerBlue}">KISIM B</td>
          <td colspan="2" style="${borderStyle} ${headerBlue}">Sürüm Detayları</td>
        </tr>
        <tr>
          <td colspan="3" style="${borderStyle} ${bgGray}">1. Belirtilmesi Gerekenler</td>
        </tr>
        <tr>
          <td colspan="3" style="${borderStyle}">
            <ul><li>&nbsp;</li><li>&nbsp;</li></ul>
          </td>
        </tr>
        <tr>
          <td colspan="3" style="${borderStyle} ${bgGray}">2. Bilinen Durumlar:</td>
        </tr>
         <tr>
          <td colspan="3" style="${borderStyle}">
            <ul><li>&nbsp;</li><li>&nbsp;</li></ul>
          </td>
        </tr>
        <tr><td colspan="3" style="height: 10px;"></td></tr>

        <!-- KISIM C -->
        <tr>
          <td style="${borderStyle} ${headerBlue}">KISIM C</td>
          <td colspan="2" style="${borderStyle} ${headerBlue}">Paket Detayları</td>
        </tr>
        <tr>
          <td colspan="3" style="${borderStyle}">
            Dokümanda iletilen geliştirmeleri test edebileceğiniz ${detectedPlatform} paketini aşağıdaki link üzerinden indirebilirsiniz.<br/><br/>
            <strong>${detectedPlatform} Platform Paket Bilgileri:</strong>
          </td>
        </tr>
        <tr>
          <td style="${borderStyle} color: blue; text-decoration: underline;">Link (Buraya Yapıştır)</td>
          <td style="${borderStyle}">${today}</td>
          <td style="${borderStyle}">Hash/ID (Opsiyonel)</td>
        </tr>
      </table>
    `;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const clipboardItem = new ClipboardItem({ 'text/html': blob });
    
    navigator.clipboard.write([clipboardItem]).then(() => {
      alert('Tablo formatı kopyalandı! Mailinize (Outlook/Gmail) yapıştırabilirsiniz.');
    }).catch(err => {
      console.error('Kopyalama hatası:', err);
      alert('Kopyalama başarısız oldu. Lütfen manuel seçip kopyalayın.');
    });
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <LayoutDashboard className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-none">Jira Release Reporter</h1>
              <p className="text-xs text-slate-500 mt-1">E-posta Şablon Oluşturucu</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {status === ReportStatus.LOADED && (
              <button 
                onClick={handleCopyToEmail}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition flex items-center gap-2 text-sm font-medium shadow-sm"
              >
                <Copy className="w-4 h-4" />
                Mail için Kopyala
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {status === ReportStatus.IDLE && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-in fade-in zoom-in duration-500">
            <div className="bg-blue-50 p-8 rounded-full mb-6">
              <FileText className="w-20 h-20 text-blue-500" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Rapor Oluşturmak İçin Dosya Yükleyin</h2>
            <p className="text-slate-500 max-w-lg mx-auto mb-8">
              Aşağıdaki jira filtreleri üzerinden Jira'dan aldığınız Excel, CSV veya HTML dosyasını yükleyin.
            </p>
            
            {/* Filter Buttons */}
            <div className="flex gap-4 mb-6">
                <a 
                  href="https://commencis.atlassian.net/issues?filter=18441" 
                  target="_blank" 
                  rel="noreferrer"
                  className="bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-lg font-semibold shadow transition flex items-center gap-2 transform hover:scale-105"
                >
                  <Smartphone className="w-5 h-5" />
                  AND Jira Filter
                </a>
                <a 
                  href="https://commencis.atlassian.net/issues?filter=18442" 
                  target="_blank" 
                  rel="noreferrer"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-lg font-semibold shadow transition flex items-center gap-2 transform hover:scale-105"
                >
                  <MonitorSmartphone className="w-5 h-5" />
                  IOS Jira Filter
                </a>
            </div>

            {/* Main Upload Area */}
            <label className="cursor-pointer group relative flex flex-col items-center justify-center w-full max-w-xl h-48 border-2 border-slate-300 border-dashed rounded-lg bg-white hover:bg-slate-50 transition-colors shadow-sm">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <UploadCloud className="w-10 h-10 mb-3 text-slate-400 group-hover:text-blue-500 transition-colors" />
                    <p className="mb-2 text-sm text-slate-500 font-semibold">Dosya seçmek için tıklayın</p>
                    <p className="text-xs text-slate-400">XLSX, CSV veya HTML</p>
                    <span className="mt-3 bg-slate-100 text-slate-600 text-xs px-3 py-1 rounded border border-slate-200 group-hover:bg-slate-200 transition">Dosya Seç</span>
                </div>
                <input type="file" accept=".xlsx,.xls,.csv,.html,.htm" onChange={handleFileUpload} className="hidden" />
            </label>

          </div>
        )}

        {status === ReportStatus.LOADING && (
          <div className="flex flex-col items-center justify-center min-h-[40vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-slate-600 font-medium">Veriler işleniyor...</p>
          </div>
        )}

        {status === ReportStatus.ERROR && (
          <div className="bg-red-50 border border-red-200 p-6 rounded-xl flex items-start gap-4">
            <AlertCircle className="text-red-500 w-6 h-6 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-red-800">Hata Oluştu</h3>
              <p className="text-red-700">{error}</p>
              <button onClick={() => setStatus(ReportStatus.IDLE)} className="mt-4 text-sm font-semibold text-red-800 underline">Tekrar Dene</button>
            </div>
          </div>
        )}

        {status === ReportStatus.LOADED && (
          <div className="space-y-8">
          
          {/* NOTIFICATION BANNERS */}
          <div className="grid gap-4">
             {/* Success Message Banner */}
             {successMessage && (
                <div className="flex items-center gap-3 bg-green-50 p-4 rounded-lg border border-green-200 animate-in fade-in slide-in-from-top-2 shadow-sm">
                   <CheckCircle2 className="text-green-600 w-6 h-6" />
                   <span className="text-green-800 font-medium">{successMessage}</span>
                </div>
             )}

             {/* Active Filter Indicator */}
             {filterCutoffTimestamp !== null && (
                <div className="flex items-center justify-between bg-amber-50 p-4 rounded-lg border border-amber-200 animate-in fade-in slide-in-from-top-2">
                   <div className="flex items-center gap-2">
                      <Filter className="text-amber-600 w-5 h-5"/>
                      <span className="text-sm text-amber-900 font-bold">
                        FİLTRE AKTİF: Bazı eski kayıtlar pasife alındı.
                      </span>
                   </div>
                   <button 
                     onClick={clearDateFilter}
                     className="text-sm bg-white border border-amber-300 text-amber-800 px-3 py-1 rounded hover:bg-amber-100 transition flex items-center gap-1"
                   >
                     <XCircle className="w-4 h-4"/> Filtreyi Temizle
                   </button>
                </div>
             )}
          </div>

          <div className="bg-white shadow-lg p-8 min-h-[800px] border border-slate-300" id="report-container" ref={reportRef}>
            {/* DOCUMENT PREVIEW START */}
            
            {/* KISIM A HEADER TABLE */}
            <table className="w-full border-collapse border border-black mb-6 text-sm font-sans">
              <colgroup>
                 <col className="w-[15%]" />
                 <col className="w-[25%]" />
                 <col className="w-[60%]" />
              </colgroup>
              <tbody>
                <tr>
                  <td className="bg-blue-700 text-white font-bold p-2 border border-black align-middle">KISIM A</td>
                  <td colSpan={2} className="bg-blue-700 text-white font-bold p-2 border border-black align-middle">Sürüm Bilgileri</td>
                </tr>
                <tr>
                  <td className="p-2 border border-black bg-slate-100 font-bold align-middle">
                    1 – Proje Bilgileri
                  </td>
                  <td className="p-2 border border-black bg-slate-100 font-bold align-middle">Tarih:</td>
                  <td className="p-2 border border-black text-left">{new Date().toLocaleDateString('tr-TR')}</td>
                </tr>
                <tr>
                  <td className="p-2 border border-black border-t-0 border-b-0"></td>
                  <td className="p-2 border border-black bg-slate-100 font-bold">Proje Bilgisi:</td>
                  <td className="p-2 border border-black">İşCep Projesi</td>
                </tr>
                <tr>
                  <td className="p-2 border border-black border-t-0 border-b-0"></td>
                  <td className="p-2 border border-black bg-slate-100 font-bold">Sürüm Bilgisi:</td>
                  <td className="p-2 border border-black">
                     {displayVersion}
                  </td>
                </tr>
                <tr>
                  <td className="p-2 border border-black border-t-0"></td>
                  <td className="p-2 border border-black bg-slate-100 font-bold">Platform:</td>
                  <td className="p-2 border border-black">
                    {detectedPlatform}
                  </td>
                </tr>
              </tbody>
            </table>
            
            {/* TALEPLER TABLE */}
            <table className="w-full border-collapse border border-black mb-6 text-sm font-sans">
              <colgroup>
                 <col className="w-[15%]" />
                 <col className="w-[25%]" />
                 <col className="w-[60%]" />
              </colgroup>
              <thead>
                <tr>
                  <td colSpan={3} className="bg-blue-700 text-white font-bold p-2 border border-black text-center">Talepler</td>
                </tr>
                <tr className="bg-slate-200">
                  <th className="p-2 border border-black text-left">Backlog ID</th>
                  <th className="p-2 border border-black text-left">Epic Name</th>
                  <th className="p-2 border border-black text-left">Açıklama</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length > 0 ? filteredTasks.map((task, idx) => {
                  const rowSpan = getEpicRowSpan(idx);
                  const hidden = isTaskHidden(task);
                  // Apply clearer gray style if hidden
                  const rowClass = hidden ? "bg-gray-300 text-gray-500 line-through decoration-gray-500" : "";
                  const linkClass = hidden ? "text-gray-500 pointer-events-none no-underline" : "text-blue-700 underline hover:text-blue-900";
                  const epicBg = hidden ? "bg-gray-300 text-gray-500" : "bg-white";

                  return (
                    <tr key={idx} className={rowClass}>
                      <td className={`p-2 border border-black ${rowClass}`}>
                        <a href={`https://commencis.atlassian.net/browse/${task.backlogId}`} target="_blank" rel="noreferrer" className={`font-mono ${linkClass}`}>
                          {task.backlogId}
                        </a>
                      </td>
                      {rowSpan > 0 && (
                        <td className={`p-2 border border-black align-middle ${epicBg}`} rowSpan={rowSpan}>
                          {task.epicName}
                        </td>
                      )}
                      <td className={`p-2 border border-black ${rowClass}`}>
                        {task.summary}
                      </td>
                    </tr>
                  );
                }) : (
                  <tr><td colSpan={3} className="p-4 border border-black text-center italic text-slate-500">Kayıt bulunamadı</td></tr>
                )}
              </tbody>
            </table>

            {/* TAMAMLANAN KAYITLAR TABLE */}
            <table className="w-full border-collapse border border-black mb-6 text-sm font-sans">
              <colgroup>
                 <col className="w-[15%]" />
                 <col className="w-[25%]" />
                 <col className="w-[60%]" />
              </colgroup>
              <thead>
                <tr>
                  <td colSpan={3} className="bg-blue-700 text-white font-bold p-2 border border-black text-center">Tamamlanan Kayıtlar</td>
                </tr>
                <tr className="bg-slate-200">
                  <th className="p-2 border border-black text-left">Defect ID</th>
                  <th className="p-2 border border-black text-left" colSpan={2}>Açıklama</th>
                </tr>
              </thead>
              <tbody>
                 {[1, 2, 3].map((i) => (
                   <tr key={i} className="h-8">
                     <td className="border border-black p-2"></td>
                     <td className="border border-black p-2" colSpan={2}></td>
                   </tr>
                 ))}
              </tbody>
            </table>

            {/* KISIM B TABLE */}
            <table className="w-full border-collapse border border-black mb-6 text-sm font-sans">
              <colgroup>
                 <col className="w-[15%]" />
                 <col className="w-[25%]" />
                 <col className="w-[60%]" />
              </colgroup>
              <thead>
                 <tr>
                    <td className="bg-blue-700 text-white font-bold p-2 border border-black align-middle">KISIM B</td>
                    <td colSpan={2} className="bg-blue-700 text-white font-bold p-2 border border-black align-middle">Sürüm Detayları</td>
                 </tr>
              </thead>
              <tbody>
                {/* 1. Belirtilmesi Gerekenler */}
                <tr className="bg-slate-100">
                  <td colSpan={3} className="p-2 border border-black font-bold">1. Belirtilmesi Gerekenler</td>
                </tr>
                <tr>
                  <td colSpan={3} className="p-4 border border-black align-top">
                    <ul className="list-disc pl-5 space-y-2">
                       <li className="h-4"></li>
                       <li className="h-4"></li>
                    </ul>
                  </td>
                </tr>

                 {/* 2. Bilinen Durumlar */}
                 <tr className="bg-slate-100">
                  <td colSpan={3} className="p-2 border border-black font-bold">2. Bilinen Durumlar:</td>
                </tr>
                <tr>
                   <td colSpan={3} className="p-4 border border-black align-top">
                    <ul className="list-disc pl-5 space-y-2">
                       <li className="h-4"></li>
                       <li className="h-4"></li>
                    </ul>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* KISIM C TABLE */}
            <table className="w-full border-collapse border border-black mb-6 text-sm font-sans">
              <colgroup>
                 <col className="w-[15%]" />
                 <col className="w-[25%]" />
                 <col className="w-[60%]" />
              </colgroup>
              <thead>
                 <tr>
                    <td className="bg-blue-700 text-white font-bold p-2 border border-black align-middle">KISIM C</td>
                    <td colSpan={2} className="bg-blue-700 text-white font-bold p-2 border border-black align-middle">Paket Detayları</td>
                 </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={3} className="p-4 border border-black">
                    <p className="mb-4">Dokümanda iletilen geliştirmeleri test edebileceğiniz {detectedPlatform} paketini aşağıdaki link üzerinden indirebilirsiniz.</p>
                    <br/>
                    <p className="font-bold border-b border-black inline-block mb-2">{detectedPlatform} Platform Paket Bilgileri:</p>
                  </td>
                </tr>
                <tr>
                   <td className="p-2 border border-black text-blue-600 underline cursor-pointer hover:text-blue-800">
                      Link_Gelecek
                   </td>
                   <td className="p-2 border border-black w-48">
                      {new Date().toLocaleString('tr-TR')}
                   </td>
                   <td className="p-2 border border-black text-xs font-mono text-slate-500">
                      hash_degeri_gelecek
                   </td>
                </tr>
              </tbody>
            </table>
            {/* DOCUMENT PREVIEW END */}
          </div>

          {/* EXTRA INFO PANEL (HISTORY TABLE) */}
          {historyViewTasks.some(t => t.statusCategoryChanged) && (
            <div className="bg-slate-100 p-6 rounded-lg border border-slate-300">
              <div className="flex items-center gap-2 mb-4">
                <History className="w-5 h-5 text-slate-600" />
                <h3 className="font-bold text-slate-700">Statü Değişiklik Geçmişi (Yeniden -> Eskiye)</h3>
              </div>
              <div className="bg-white border border-slate-200 rounded p-4 mb-4 text-sm text-slate-600 flex gap-2 items-start">
                  <CalendarClock className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                  <p>
                    Aşağıdaki listede bir tarihe tıklayarak, <strong>o tarih ve öncesindeki (daha eski)</strong> tüm kayıtları rapordan silebilirsiniz. 
                    Böylece sadece son gönderimden sonra gelenleri raporlayabilirsiniz.
                  </p>
              </div>
              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full bg-white border border-slate-300 text-sm">
                  {/* Fixed Sticky Header overlapping issue by adding solid background and z-index */}
                  <thead className="sticky top-0 bg-slate-200 shadow-sm z-10">
                    <tr className="text-slate-700">
                      <th className="p-2 border text-left bg-slate-200">Backlog ID</th>
                      <th className="p-2 border text-left bg-slate-200">Summary</th>
                      <th className="p-2 border text-left bg-slate-200">Sürüm (Build)</th>
                      <th className="p-2 border text-left cursor-help bg-slate-200" title="Filtrelemek için tarihe tıklayın">Statü Değişim Tarihi (Tıkla & Filtrele)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyViewTasks.map((t, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 border font-mono">{t.backlogId}</td>
                        <td className="p-2 border truncate max-w-xs" title={t.summary}>{t.summary}</td>
                        <td className="p-2 border">{t.fixBuild || '-'}</td>
                        <td 
                          className="p-2 border text-blue-600 hover:text-white hover:bg-red-500 cursor-pointer font-medium transition-colors duration-200 group relative"
                          onClick={() => handleDateFilter(t.statusCategoryChanged)}
                        >
                          <span className="group-hover:hidden">{t.statusCategoryChanged || '-'}</span>
                          <span className="hidden group-hover:inline flex items-center gap-1">
                             <Trash2 className="w-3 h-3 inline"/> Bu ve öncekileri gizle
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
