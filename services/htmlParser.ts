
import { JiraTask } from '../types';

export const parseJiraHtml = async (file: File): Promise<JiraTask[]> => {
  const text = await file.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');

  // Jira HTML exports usually have an id="issuetable" and rows with class "issuerow"
  const rows = Array.from(doc.querySelectorAll('#issuetable tbody tr.issuerow'));

  // Determine the column index for "Status Category Changed"
  // This is necessary because it might not have a specific class like "issuekey"
  const headers = Array.from(doc.querySelectorAll('#issuetable thead tr th, table thead tr th'));
  const statusCategoryChangedIndex = headers.findIndex(h => {
    const txt = h.textContent?.toLowerCase().trim() || '';
    return txt.includes('status category changed') || 
           txt.includes('category changed') || 
           txt.includes('statü değişim tarihi');
  });

  if (rows.length === 0) {
    // Fallback: try looking for any table with class "aui" if id is missing, or generic rows
    const genericRows = Array.from(doc.querySelectorAll('table tbody tr'));
    if (genericRows.length < 2) { 
        throw new Error("HTML dosyasında uygun veri tablosu bulunamadı. Lütfen Jira'dan 'HTML (Current fields)' seçeneği ile çıktı aldığınızdan emin olun.");
    }
  }

  const tasks: JiraTask[] = rows.map(row => {
    // Helper to safely extract text from a cell by class name
    const getText = (className: string): string => {
      const el = row.querySelector(`.${className}`);
      return el ? el.textContent?.trim() || '' : '';
    };

    // Helper to get text by index (for Status Category Changed)
    const getByIndex = (idx: number): string => {
        if (idx === -1) return '';
        const cells = row.querySelectorAll('td');
        return cells[idx]?.textContent?.trim() || '';
    };

    // 1. Backlog ID (Key)
    const backlogId = getText('issuekey') || row.querySelector('.key')?.textContent?.trim() || 'N/A';

    // 2. Summary
    const summary = getText('summary') || 'N/A';

    // 3. Epic Name / Parent
    // In the sample, "Parent" column holds the grouping info.
    // Also checking customfield_10006 which is often Epic Link in standard Jira.
    const epicName = getText('parent') || getText('customfield_10006') || getText('customfield_epic_link') || 'No Epic';

    // 4. Fix Version
    const fixVersion = getText('fixVersions') || 'Unscheduled';

    // 5. Fix Build
    // Based on sample: customfield_10097 corresponds to "Fix Build #"
    // We also check generic names just in case.
    const fixBuild = getText('customfield_10097') || getText('fixBuild') || 'General';

    // 6. Status
    const status = getText('status') || 'Unknown';

    // 7. Status Category Changed
    // Try to find via index first, otherwise look for common possible classes or defaults
    let statusCategoryChanged = '';
    if (statusCategoryChangedIndex !== -1) {
        statusCategoryChanged = getByIndex(statusCategoryChangedIndex);
    } else {
        // Fallback: sometimes it might be 'updated' field if explicitly mapped
        statusCategoryChanged = getText('updated') || '';
    }

    return {
      backlogId,
      summary,
      epicName,
      fixVersion,
      fixBuild,
      status,
      originalKey: backlogId,
      statusCategoryChanged
    };
  });

  return tasks;
};
