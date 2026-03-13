
import { JiraTask } from '../types';

export const parseJiraHtml = async (file: File): Promise<JiraTask[]> => {
  const text = await file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');

  // Find the primary issue table
  const table = doc.querySelector('#issuetable') || doc.querySelector('table.aui') || doc.querySelector('table');
  if (!table) {
    throw new Error("HTML dosyasında uygun veri tablosu bulunamadı. Lütfen Jira'dan 'HTML (Current fields)' seçeneği ile çıktı aldığınızdan emin olun.");
  }

  // Extract headers to identify column indexes
  const headers = Array.from(table.querySelectorAll('thead tr th, tr:first-child th, tr:first-child td.searcherHeader'));

  const statusCategoryChangedIndex = headers.findIndex(h => {
    const txt = h.textContent?.toLowerCase().trim() || '';
    return txt.includes('status category changed') ||
      txt.includes('category changed') ||
      txt.includes('statü değişim tarihi');
  });



  const issueTypeIndex = headers.findIndex(h => {
    const txt = h.textContent?.toLowerCase().trim() || '';
    return txt.includes('issue type') || txt.includes('sorun tipi');
  });

  // Extract rows, excluding those that are likely headers or empty
  let rows = Array.from(table.querySelectorAll('tbody tr, tr')).filter(r => {
    // A data row must have cells (td) and not be a header row
    return r.querySelector('td') && !r.querySelector('th');
  });

  if (rows.length === 0) {
    throw new Error("Tabloda veri satırı bulunamadı.");
  }

  const tasks: JiraTask[] = rows.map(row => {
    const cells = Array.from(row.querySelectorAll('td'));

    // Helper to safely extract text from a cell by class name or index
    const getText = (className: string): string => {
      const el = row.querySelector(`.${className}`);
      return el ? el.textContent?.trim() || '' : '';
    };

    const getByIndex = (idx: number): string => {
      if (idx === -1) return '';
      return cells[idx]?.textContent?.trim() || '';
    };

    // 1. Original Key (e.g. ISCEPANDROID-1234)
    const originalKey = getText('issuekey') || getText('key') || row.querySelector('.key')?.textContent?.trim() || getByIndex(headers.findIndex(h => h.textContent?.toLowerCase().includes('key'))) || 'N/A';

    // Issue Type
    let issueType = getText('issuetype');
    if (!issueType && issueTypeIndex !== -1) {
      issueType = getByIndex(issueTypeIndex);
    }
    // Fallback if extracting failed but row has typical bug markers? No, default to Story to be safe or keep empty.
    if (!issueType) issueType = 'Story';

    // 2. Backlog ID Logic (Prioritize CCRSP key)
    let backlogId = '-';
    let externalRcId = '-';

    // Search the ENTIRE row text to reliably capture linked issues 
    // regardless of the exact Jira column name they exported
    const allRowText = row.textContent || '';

    const ccrspMatch = allRowText.match(/CCRSP[\s-]*\d+/i);
    if (ccrspMatch) {
      let m = ccrspMatch[0].replace(/\s+/g, '').toUpperCase();
      if (!m.includes('-')) m = m.replace('CCRSP', 'CCRSP-');
      backlogId = m;
    }

    const extRcMatch = allRowText.match(/(ISCEPEXTRC|ISCOREXT)[\s-]*\d+/i);
    if (extRcMatch) {
      let m = extRcMatch[0].replace(/\s+/g, '').toUpperCase();
      if (!m.includes('-')) m = m.replace('ISCEPEXTRC', 'ISCEPEXTRC-').replace('ISCOREXT', 'ISCOREXT-');
      externalRcId = m;
    }

    if (issueType.toLowerCase() !== 'bug') {
      if (externalRcId !== '-') {
        issueType = 'Bug';
      } else if (
        allRowText.toLowerCase().includes('accessibilitybug') ||
        allRowText.toLowerCase().match(/\bbug\b/i) ||
        allRowText.toLowerCase().includes('external')
      ) {
        issueType = 'Bug';
      }
    }

    // 3. Summary
    const summary = getText('summary') || getByIndex(headers.findIndex(h => h.textContent?.toLowerCase().includes('summary') || h.textContent?.toLowerCase().includes('özet'))) || 'N/A';

    // 4. Epic Name / Parent
    const epicName = getText('parent') || getText('customfield_10006') || getText('customfield_epic_link') || 'No Epic';

    // 5. Fix Version
    const fixVersion = getText('fixVersions') || 'Unscheduled';

    // 6. Fix Build
    const fixBuild = getText('customfield_10097') || getText('fixBuild') || 'General';

    // 7. Status
    const status = getText('status') || getByIndex(headers.findIndex(h => h.textContent?.toLowerCase().includes('status') || h.textContent?.toLowerCase().includes('durum'))) || 'Unknown';

    // 8. Status Category Changed
    let statusCategoryChanged = '';
    if (statusCategoryChangedIndex !== -1) {
      statusCategoryChanged = getByIndex(statusCategoryChangedIndex);
    } else {
      statusCategoryChanged = getText('updated') || '';
    }

    return {
      backlogId,
      summary,
      epicName,
      fixVersion,
      fixBuild,
      status,
      originalKey,
      statusCategoryChanged,
      issueType,
      externalRcId
    };
  });

  return tasks;
};