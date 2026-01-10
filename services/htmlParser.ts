
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

  const linkedIssuesIndex = headers.findIndex(h => {
    const txt = h.textContent?.toLowerCase().trim() || '';
    return txt.includes('linked issues') || 
           txt.includes('bağlı kayıtlar') ||
           txt.includes('linked');
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

    // 2. Backlog ID Logic (Prioritize CCRSP key)
    let backlogId = '-';

    // Check specific "Linked Issues" column first
    if (linkedIssuesIndex !== -1) {
        const linkedText = getByIndex(linkedIssuesIndex);
        const ccrspMatch = linkedText.match(/(CCRSP-\d+)/);
        if (ccrspMatch) {
            backlogId = ccrspMatch[0];
        }
    }

    // SAFETY FALLBACK: If Backlog ID is still '-' but CCRSP exists anywhere in the row text, capture it.
    // This handles cases where column indexing might be off due to Jira's inconsistent HTML output.
    if (backlogId === '-') {
        const fullRowText = row.textContent || '';
        const globalMatch = fullRowText.match(/(CCRSP-\d+)/);
        if (globalMatch) {
            backlogId = globalMatch[0];
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
      statusCategoryChanged
    };
  });

  return tasks;
};
