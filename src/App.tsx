import React, { useState, useMemo, useRef } from 'react';
import { 
  Copy, 
  LayoutDashboard, 
  FileText,
  History,
  Smartphone,
  MonitorSmartphone,
  UploadCloud,
  RotateCcw,
  FileDown
} from 'lucide-react';
import { parseJiraExcel } from '../services/excelParser';
import { parseJiraHtml } from '../services/htmlParser';
import { JiraTask, ReportStatus } from '../types';


// html2pdf kütüphanesini dışarıdan alıyoruz
declare const html2pdf: any;

const App: React.FC = () => {
  const [tasks, setTasks] = useState<JiraTask[]>([]);
  const [status, setStatus] = useState<ReportStatus>(ReportStatus.IDLE);
  const [error, setError] = useState<string | null>(null);
  
  const [filterCutoffTimestamp, setFilterCutoffTimestamp] = useState<number | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  const reportRef = useRef<HTMLDivElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setStatus(ReportStatus.LOADING);
    setError(null);
    setFilterCutoffTimestamp(null); 
    setSuccessMessage(null);

    try {
      let parsedTasks: JiraTask[] = [];
      if (file.name.toLowerCase().endsWith('.html') || file.name.toLowerCase().endsWith('.htm')) {
        parsedTasks = await parseJiraHtml(file);
      } else {
        parsedTasks = await parseJiraExcel(file);
      }
      setTasks(parsedTasks);
      setStatus(ReportStatus.LOADED);
    } catch (err: any) {
      setError(err.message);
      setStatus(ReportStatus.ERROR);
    }
  };

  const handleReset = () => {
    setTasks([]);
    setStatus(ReportStatus.IDLE);
    setError(null);
    setFilterCutoffTimestamp(null);
    setSuccessMessage(null);
  };

  const handleDateClick = (dateStr: string) => {
    const ts = parseJiraDate(dateStr);
    if (ts > 0) {
      setFilterCutoffTimestamp(ts);
      // Raporun başına yumuşak bir kaydırma yapalım ki değişiklik görülsün
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const parseJiraDate = (dateStr: string): number => {
    if (!dateStr) return 0;
    let clean = dateStr.trim().toLowerCase().replace(/\s+/g, ' ');
    const replacements: { [key: string]: string } = {
        'ocak': 'jan', 'oca': 'jan', 'şubat': 'feb', 'subat': 'feb', 'şub': 'feb', 'sub': 'feb',
        'mart': 'mar', 'nisan': 'apr', 'nis': 'apr', 'mayıs': 'may', 'haziran': 'jun', 'haz': 'jun',
        'temmuz': 'jul', 'tem': 'jul', 'ağustos': 'aug', 'agustos': 'aug', 'ağu': 'aug', 'agu': 'aug',
        'eylül': 'sep', 'eylul': 'sep', 'eyl': 'sep', 'ekim': 'oct', 'eki': 'oct', 'kasım': 'nov',
        'kasim': 'nov', 'kas': 'nov', 'aralık': 'dec', 'aralik': 'dec', 'ara': 'dec', 'öö': 'am', 'ös': 'pm'
    };
    Object.keys(replacements).forEach(key => {
        const regex = new RegExp(key, 'g');
        clean = clean.replace(regex, replacements[key]);
    });
    clean = clean.replace(/\./g, '/').replace(/-/g, '/');
    let timestamp = Date.parse(clean);
    if (!isNaN(timestamp)) return timestamp;
    const parts = clean.match(/(\d{1,2})[\/](\w{3})[\/](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?:\s+(am|pm))?)?/);
    if (parts) {
        const [, day, monthStr, yearStr, hourStr, minStr, ampm] = parts;
        const monthMap: {[key:string]: number} = {jan:0, feb:1, mar:2, apr:3, may:4, jun:5, jul:6, aug:7, sep:8, oct:9, nov:10, dec:11};
        const month = monthMap[monthStr];
        if (month !== undefined) {
            let year = parseInt(yearStr);
            if (year < 100) year += 2000;
            let hour = hourStr ? parseInt(hourStr) : 0;
            let min = minStr ? parseInt(minStr) : 0;
            if (ampm === 'pm' && hour < 12) hour += 12;
            if (ampm === 'am' && hour === 12) hour = 0;
            return new Date(year, month, parseInt(day), hour, min).getTime();
        }
    }
    return 0;
  };

  const isApproved = (t: JiraTask) => 
    t.status.toLowerCase().includes('approved') || 
    t.status.toLowerCase().includes('onay') || 
    t.status.toLowerCase().includes('test passed');

  const filteredTasks = useMemo(() => {
    let result = tasks.filter(isApproved);
    return result.sort((a, b) => {
      const dateA = parseJiraDate(a.statusCategoryChanged);
      const dateB = parseJiraDate(b.statusCategoryChanged);
      const isHiddenA = filterCutoffTimestamp !== null && dateA <= filterCutoffTimestamp;
      const isHiddenB = filterCutoffTimestamp !== null && dateB <= filterCutoffTimestamp;
      if (isHiddenA !== isHiddenB) return isHiddenA ? 1 : -1;
      return (a.epicName || '').localeCompare(b.epicName || '');
    });
  }, [tasks, filterCutoffTimestamp]); 

  const storyTasks = useMemo(() => {
    return filteredTasks.filter(t => t.issueType.toLowerCase() !== 'bug');
  }, [filteredTasks]);

  const bugTasks = useMemo(() => {
    return filteredTasks.filter(t => t.issueType.toLowerCase() === 'bug');
  }, [filteredTasks]);

  const detectedPlatform = useMemo(() => {
    const keys = tasks.map(t => t.originalKey ? t.originalKey.toUpperCase() : '');
    if (keys.some(k => k.includes('ISCEPANDROID'))) return 'ANDROID';
    if (keys.some(k => k.includes('ISCEPIPHONE'))) return 'IOS';
    return 'IOS';
  }, [tasks]);

  const displayVersion = useMemo(() => {
    const activeTasks = filteredTasks.filter(t => {
      if (filterCutoffTimestamp === null) return true;
      return parseJiraDate(t.statusCategoryChanged) > filterCutoffTimestamp;
    });
    const allBuilds = activeTasks.map(t => t.fixBuild).flatMap(fb => fb.split(',').map(s => s.trim())).filter(b => b.length > 0);
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

  const getEpicRowSpan = (taskIndex: number) => {
    const currentTask = storyTasks[taskIndex];
    if (taskIndex > 0 && storyTasks[taskIndex - 1].epicName === currentTask.epicName) return 0;
    let span = 1;
    for (let i = taskIndex + 1; i < storyTasks.length; i++) {
      if (storyTasks[i].epicName === currentTask.epicName) span++; else break;
    }
    return span;
  };

  const handleDownloadPDF = () => {
    if (!reportRef.current) return;
    setSuccessMessage('PDF hazırlanıyor, lütfen bekleyin...');
    html2pdf()
      .set({
        margin: 0,
        filename: `Jira_Release_${displayVersion || 'Report'}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, logging: false, scrollY: 0 },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      })
      .from(reportRef.current)
      .save()
      .then(() => {
        setSuccessMessage('PDF başarıyla indirildi!');
        setTimeout(() => setSuccessMessage(null), 3000);
      });
  };

  const handleCopyToEmail = () => {
    if (!reportRef.current) return;
    const today = new Date().toLocaleDateString('tr-TR');
    const borderStyle = 'border: 1px solid black; border-collapse: collapse; padding: 4px; font-family: Calibri, sans-serif; font-size: 11pt; vertical-align: top;';
    const headerBlue = 'background-color: #0052cc; color: white; font-weight: bold; vertical-align: middle;';
    const bgGray = 'background-color: #f2f2f2; font-weight: bold; vertical-align: middle;';
    
    let storyRows = '';
    const getActiveEpicRowSpan = (taskIndex: number, list: JiraTask[]) => {
        const currentTask = list[taskIndex];
        if (taskIndex > 0 && list[taskIndex - 1].epicName === currentTask.epicName) return 0;
        let span = 1;
        for (let i = taskIndex + 1; i < list.length; i++) {
          if (list[i].epicName === currentTask.epicName) span++; else break;
        }
        return span;
    };

    for (let i = 0; i < storyTasks.length; i++) {
      const t = storyTasks[i];
      const rowSpan = getActiveEpicRowSpan(i, storyTasks);
      const isGrayedOut = filterCutoffTimestamp !== null && parseJiraDate(t.statusCategoryChanged) <= filterCutoffTimestamp;
      const textStyle = isGrayedOut ? 'color: #334155; font-style: italic;' : 'color: #000000;';
      const cellBg = isGrayedOut ? 'background-color: #cbd5e1;' : 'background-color: #ffffff;';
      let epicCell = rowSpan > 0 ? `<td rowspan="${rowSpan}" style="${borderStyle} vertical-align: middle; ${isGrayedOut ? 'background-color: #cbd5e1; font-style: italic;' : 'background-color: #ffffff;'}">${t.epicName}</td>` : '';
      const displayId = t.backlogId;
      const idCellContent = displayId !== '-' ? `<a href="https://commencis.atlassian.net/browse/${displayId}" style="color: blue; text-decoration: underline;">${displayId}</a>` : displayId;
      storyRows += `<tr><td style="${borderStyle} ${textStyle} ${cellBg}">${idCellContent}</td>${epicCell}<td style="${borderStyle} ${textStyle} ${cellBg}">${t.summary}</td></tr>`;
    }

    let bugRows = bugTasks.length > 0 ? bugTasks.map(t => {
      const isGrayedOut = filterCutoffTimestamp !== null && parseJiraDate(t.statusCategoryChanged) <= filterCutoffTimestamp;
      const defectId = t.externalRcId !== '-' ? t.externalRcId : '-';
      const idContent = defectId !== '-' ? `<a href="https://commencis.atlassian.net/browse/${defectId}" style="color: blue; text-decoration: underline;">${defectId}</a>` : defectId;
      return `<tr><td style="${borderStyle} ${isGrayedOut ? 'background-color: #cbd5e1; font-style: italic;' : 'background-color: #ffffff;'}">${idContent}</td><td colspan="2" style="${borderStyle} ${isGrayedOut ? 'background-color: #cbd5e1; font-style: italic;' : 'background-color: #ffffff;'}">${t.summary}</td></tr>`;
    }).join('') : `<tr><td style="${borderStyle} height: 20px;">&nbsp;</td><td colspan="2" style="${borderStyle}">&nbsp;</td></tr>`;

    const infoRow = filterCutoffTimestamp !== null ? `<tr><td colspan="3" style="padding-bottom: 4px; border: none;"><table border="0" cellpadding="0" cellspacing="0"><tr><td style="vertical-align: middle; padding-right: 6px;"><table border="1" style="width: 16px; height: 16px; border: 1px solid #ea580c; border-radius: 8px;"><tr><td align="center" style="font-family: Calibri; font-size: 9pt; font-weight: bold; color: #ea580c;">i</td></tr></table></td><td style="font-family: Calibri; font-size: 10.5pt; font-weight: bold; font-style: italic; color: #ea580c;">Aşağıda testi yeni tamamlanan kayıtlar beyaz , önceki paketler ile iletilmiş olanlar gri olarak belirtilmiştir.</td></tr></table></td></tr>` : '';

    const htmlContent = `<table style="width: 100%; border-collapse: collapse; font-family: Calibri; table-layout: fixed;"><colgroup><col style="width: 15%"><col style="width: 20%"><col style="width: 65%"></colgroup><tr><td style="${borderStyle} ${headerBlue}">KISIM A</td><td colspan="2" style="${borderStyle} ${headerBlue}">Sürüm Bilgileri</td></tr><tr><td style="${borderStyle} ${bgGray}">1 - Proje Bilgileri</td><td style="${borderStyle} ${bgGray}">Tarih:</td><td style="${borderStyle}">${today}</td></tr><tr><td style="${borderStyle}">&nbsp;</td><td style="${borderStyle} ${bgGray}">Proje Bilgisi:</td><td style="${borderStyle}">İşCep Projesi</td></tr><tr><td style="${borderStyle}">&nbsp;</td><td style="${borderStyle} ${bgGray}">Sürüm Bilgisi:</td><td style="${borderStyle}">${displayVersion}</td></tr><tr><td style="${borderStyle}">&nbsp;</td><td style="${borderStyle} ${bgGray}">Platform:</td><td style="${borderStyle}">${detectedPlatform}</td></tr><tr><td colspan="3" style="height: 5px; border: none;"></td></tr>${infoRow}<tr><td colspan="3" style="${borderStyle} ${headerBlue} text-align: center;">Talepler</td></tr><tr><td style="${borderStyle} ${bgGray}">Backlog ID</td><td style="${borderStyle} ${bgGray}">Epic Name</td><td style="${borderStyle} ${bgGray}">Açıklama</td></tr>${storyRows}<tr><td colspan="3" style="height: 5px; border: none;"></td></tr><tr><td colspan="3" style="${borderStyle} ${headerBlue} text-align: center;">Tamamlanan Kayıtlar</td></tr><tr><td style="${borderStyle} ${bgGray}">Defect ID</td><td colspan="2" style="${borderStyle} ${bgGray}">Açıklama</td></tr>${bugRows}<tr><td colspan="3" style="height: 5px; border: none;"></td></tr><tr><td style="${borderStyle} ${headerBlue}">KISIM B</td><td colspan="2" style="${borderStyle} ${headerBlue}">Sürüm Detayları</td></tr><tr><td colspan="3" style="${borderStyle} ${bgGray}">1. Belirtilmesi Gerekenler</td></tr><tr><td colspan="3" style="${borderStyle}"><ul><li>&nbsp;</li></ul></td></tr><tr><td colspan="3" style="${borderStyle} ${bgGray}">2. Bilinen Durumlar:</td></tr><tr><td colspan="3" style="${borderStyle}"><ul><li>&nbsp;</li></ul></td></tr><tr><td colspan="3" style="height: 5px; border: none;"></td></tr><tr><td style="${borderStyle} ${headerBlue}">KISIM C</td><td colspan="2" style="${borderStyle} ${headerBlue}">Paket Detayları</td></tr><tr><td colspan="3" style="${borderStyle}">Dokümanda iletilen geliştirmeleri test edebileceğiniz ${detectedPlatform} paketini aşağıdaki link üzerinden indirebilirsiniz.<br/><br/><strong>${detectedPlatform} Platform Paket Bilgileri:</strong></td></tr><tr><td style="${borderStyle} color: blue; text-decoration: underline;">Paket URL</td><td style="${borderStyle}">Created</td><td style="${borderStyle}">Revision</td></tr></table>`;
    
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const clipboardItem = new ClipboardItem({ 'text/html': blob });
    navigator.clipboard.write([clipboardItem]).then(() => {
      setSuccessMessage('Tüm kayıtlar ve bölümler kopyalandı!');
      setTimeout(() => setSuccessMessage(null), 3000);
    });
  };

  const historyViewTasks = useMemo(() => {
    return tasks.filter(isApproved).sort((a, b) => parseJiraDate(b.statusCategoryChanged) - parseJiraDate(a.statusCategoryChanged));
  }, [tasks]);

  return (
    <div className="min-h-screen flex flex-col bg-slate-100">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50 no-print">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg"><LayoutDashboard className="text-white w-6 h-6" /></div>
            <div><h1 className="text-lg font-bold text-slate-900 leading-none">Jira Release Reporter</h1></div>
          </div>
          <div className="flex items-center gap-4">
            {status === ReportStatus.LOADED && (
              <>
                <button onClick={handleReset} className="bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 px-4 py-2 rounded-md transition flex items-center gap-2 text-sm font-medium shadow-sm"><RotateCcw className="w-4 h-4" />Yeni Rapor</button>
                <button onClick={handleDownloadPDF} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-md transition flex items-center gap-2 text-sm font-medium shadow-sm"><FileDown className="w-4 h-4" />PDF İndir</button>
                <button onClick={handleCopyToEmail} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition flex items-center gap-2 text-sm font-medium shadow-sm"><Copy className="w-4 h-4" />Mail için Kopyala</button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {status === ReportStatus.IDLE && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center animate-in fade-in zoom-in duration-500">
            <div className="bg-blue-50 p-8 rounded-full mb-6"><FileText className="w-20 h-20 text-blue-500" /></div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Rapor Oluşturmak İçin Dosya Yükleyin</h2>
            <p className="text-slate-500 max-w-lg mx-auto mb-8">Jira'dan alınan Excel, CSV veya HTML dosyasını yükleyin.</p>
            <div className="flex gap-4 mb-6">
                <a href="https://commencis.atlassian.net/issues?filter=18441" target="_blank" rel="noreferrer" className="bg-green-600 hover:bg-green-700 text-white px-5 py-3 rounded-lg font-semibold shadow transition flex items-center gap-2 transform hover:scale-105"><Smartphone className="w-5 h-5" />AND Filter</a>
                <a href="https://commencis.atlassian.net/issues?filter=18442" target="_blank" rel="noreferrer" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-lg font-semibold shadow transition flex items-center gap-2 transform hover:scale-105"><MonitorSmartphone className="w-5 h-5" />IOS Filter</a>
            </div>
            <label className="cursor-pointer group relative flex flex-col items-center justify-center w-full max-w-xl h-48 border-2 border-slate-300 border-dashed rounded-lg bg-white hover:bg-slate-50 transition-colors shadow-sm">
                <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <UploadCloud className="w-10 h-10 mb-3 text-slate-400 group-hover:text-blue-500 transition-colors" />
                    <p className="mb-2 text-sm text-slate-500 font-semibold">Dosya seçmek için tıklayın</p>
                    <p className="text-xs text-slate-400">XLSX, CSV veya HTML</p>
                </div>
                <input type="file" accept=".xlsx,.xls,.csv,.html,.htm" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        )}

        {status === ReportStatus.LOADED && (
          <div className="space-y-8">
            {successMessage && <div className="bg-green-50 p-4 rounded-lg border border-green-200 text-green-800 font-medium no-print">{successMessage}</div>}
            
            <div className="bg-white shadow-xl mx-auto" id="pdf-root" ref={reportRef}>
              <table>
                <colgroup><col style={{ width: '15%' }} /><col style={{ width: '20%' }} /><col style={{ width: '65%' }} /></colgroup>
                <tbody>
                  <tr><td className="header-blue">KISIM A</td><td colSpan={2} className="header-blue">Sürüm Bilgileri</td></tr>
                  <tr><td className="bg-gray">1 – Proje Bilgileri</td><td className="bg-gray">Tarih:</td><td className="text-left">{new Date().toLocaleDateString('tr-TR')}</td></tr>
                  <tr><td className="border-t-0 border-b-0"></td><td className="bg-gray">Proje Bilgisi:</td><td>İşCep Projesi</td></tr>
                  <tr><td className="border-t-0 border-b-0"></td><td className="bg-gray">Sürüm Bilgisi:</td><td>{displayVersion}</td></tr>
                  <tr><td className="border-t-0"></td><td className="bg-gray">Platform:</td><td>{detectedPlatform}</td></tr>
                </tbody>
              </table>

              {filterCutoffTimestamp !== null && (
                <div style={{ padding: '2px 0', border: 'none' }} className="no-print">
                  <table style={{ border: 'none' }}>
                    <tr style={{ border: 'none' }}>
                      <td style={{ border: 'none', width: '24px', paddingRight: '4px', verticalAlign: 'middle' }}>
                        <div style={{ width: '16px', height: '16px', border: '1.5px solid #ea580c', borderRadius: '50%', textAlign: 'center', color: '#ea580c', fontSize: '10px', fontWeight: 'bold', fontStyle: 'normal', lineHeight: '14px' }}>i</div>
                      </td>
                      <td style={{ border: 'none', color: '#ea580c', fontWeight: 'bold', fontStyle: 'italic', fontSize: '12.5px', padding: '0', verticalAlign: 'middle' }}>Aşağıda testi yeni tamamlanan kayıtlar beyaz , önceki paketler ile iletilmiş olanlar gri olarak belirtilmiştir.</td>
                    </tr>
                  </table>
                </div>
              )}
              
              <table style={{ marginTop: '5px' }}>
                <colgroup><col style={{ width: '15%' }} /><col style={{ width: '20%' }} /><col style={{ width: '65%' }} /></colgroup>
                <thead><tr><td colSpan={3} className="header-blue text-center">Talepler</td></tr><tr className="bg-gray"><th>Backlog ID</th><th>Epic Name</th><th>Açıklama</th></tr></thead>
                <tbody>
                  {storyTasks.map((task, idx) => {
                    const rowSpan = getEpicRowSpan(idx);
                    const isGrayedOut = filterCutoffTimestamp !== null && parseJiraDate(task.statusCategoryChanged) <= filterCutoffTimestamp;
                    return (
                      <tr key={idx} className={isGrayedOut ? "bg-slate-300" : ""}>
                        <td style={{ fontStyle: isGrayedOut ? 'italic' : 'normal' }}>
                          {task.backlogId !== '-' ? <a href={`https://commencis.atlassian.net/browse/${task.backlogId}`} target="_blank" rel="noreferrer" style={{ color: 'blue', textDecoration: 'underline' }}>{task.backlogId}</a> : task.backlogId}
                        </td>
                        {rowSpan > 0 && <td rowSpan={rowSpan} className={isGrayedOut ? "bg-slate-300" : "bg-white"} style={{ verticalAlign: 'middle', fontStyle: isGrayedOut ? 'italic' : 'normal' }}>{task.epicName}</td>}
                        <td style={{ fontStyle: isGrayedOut ? 'italic' : 'normal' }}>{task.summary}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <table style={{ marginTop: '10px' }}>
                <colgroup><col style={{ width: '15%' }} /><col style={{ width: '85%' }} /></colgroup>
                <thead><tr><td colSpan={2} className="header-blue text-center">Tamamlanan Kayıtlar</td></tr><tr className="bg-gray"><th>Defect ID</th><th>Açıklama</th></tr></thead>
                <tbody>
                  {bugTasks.length > 0 ? bugTasks.map((task, idx) => {
                    const isGrayedOut = filterCutoffTimestamp !== null && parseJiraDate(task.statusCategoryChanged) <= filterCutoffTimestamp;
                    const defectId = task.externalRcId !== '-' ? task.externalRcId : '-';
                    return (
                      <tr key={idx} className={isGrayedOut ? "bg-slate-300" : ""}>
                        <td style={{ fontStyle: isGrayedOut ? 'italic' : 'normal' }}>
                          {defectId !== '-' ? <a href={`https://commencis.atlassian.net/browse/${defectId}`} target="_blank" rel="noreferrer" style={{ color: 'blue', textDecoration: 'underline' }}>{defectId}</a> : defectId}
                        </td>
                        <td style={{ fontStyle: isGrayedOut ? 'italic' : 'normal' }}>{task.summary}</td>
                      </tr>
                    );
                  }) : <tr style={{ height: '40px' }}><td></td><td></td></tr>}
                </tbody>
              </table>
              <table style={{ marginTop: '10px' }}>
                <thead><tr><td className="header-blue">KISIM B</td><td colSpan={2} className="header-blue">Sürüm Detayları</td></tr></thead>
                <tbody>
                  <tr><td colSpan={3} className="bg-gray">1. Belirtilmesi Gerekenler</td></tr>
                  <tr><td colSpan={3} style={{ height: '50px', verticalAlign: 'top' }}><ul style={{ listStyleType: 'disc', paddingLeft: '20px', margin: 0 }}><li>&nbsp;</li></ul></td></tr>
                  <tr><td colSpan={3} className="bg-gray">2. Bilinen Durumlar:</td></tr>
                  <tr><td colSpan={3} style={{ height: '50px', verticalAlign: 'top' }}><ul style={{ listStyleType: 'disc', paddingLeft: '20px', margin: 0 }}><li>&nbsp;</li></ul></td></tr>
                </tbody>
              </table>
            </div>

            {historyViewTasks.length > 0 && (
              <div className="bg-white p-6 rounded-lg border border-slate-300 no-print">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-slate-700 flex items-center gap-2"><History className="w-5 h-5" /> Tarih Bazlı Filtrele</h3>
                  {filterCutoffTimestamp !== null && <button onClick={() => setFilterCutoffTimestamp(null)} className="text-sm text-red-600 hover:text-red-800 underline font-medium transition-colors">Filtreyi Kaldır</button>}
                </div>
                
                <div className="flex items-start gap-2 mb-4">
                  <div className="flex-shrink-0 w-4 h-4 rounded-full border-[1.5px] border-orange-600 flex items-center justify-center mt-[2px]"><span className="text-[10px] font-bold text-orange-600 leading-none">i</span></div>
                  <p className="text-orange-600 font-bold italic text-[12.5px] leading-tight">En son yapılan Paket paylaşım tarih saatine göre bu listeden seçim yapılarak gönderilmiş kayıtlar pasif duruma getilir.</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="bg-slate-100"><th className="p-2 border text-left">ID</th><th className="p-2 border text-left">Summary</th><th className="p-2 border text-left">Tarih</th></tr></thead>
                    <tbody>
                      {historyViewTasks.map((t, idx) => {
                        const displayId = (t.issueType.toLowerCase() === 'bug' && t.externalRcId !== '-') ? t.externalRcId : t.backlogId;
                        const isCurrentFilter = filterCutoffTimestamp === parseJiraDate(t.statusCategoryChanged);
                        return (
                          <tr key={idx} className={`hover:bg-slate-50 cursor-pointer ${isCurrentFilter ? 'bg-blue-50' : ''}`} onClick={() => handleDateClick(t.statusCategoryChanged)}>
                            <td className="p-2 border font-medium">{displayId}</td>
                            <td className="p-2 border truncate max-w-xs">{t.summary}</td>
                            <td className="p-2 border text-blue-600 font-semibold">{t.statusCategoryChanged}</td>
                          </tr>
                        );
                      })}
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