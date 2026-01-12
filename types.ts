
export interface JiraTask {
  backlogId: string;
  summary: string;
  epicName: string;
  fixVersion: string;
  fixBuild: string;
  status: string;
  originalKey: string; // Added for platform detection (ISCEPANDROID/ISCEPIPHONE)
  statusCategoryChanged: string; // New field for reporting history info
  issueType: string; // New field to distinguish Bug vs Story
  externalRcId: string; // New field for ISCEPEXTRC-xxxx
}

export interface ReportConfig {
  version: string;
  build: string;
  tasks: JiraTask[];
}

export enum ReportStatus {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  LOADED = 'LOADED',
  ERROR = 'ERROR'
}