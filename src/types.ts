interface Metadata {
  [key: string]: string;
}

interface MeetingStorageFile {
  bucket: string;
  filename: string;
}

export interface MeetingFile {
  filePath: string;
  storagePath?: MeetingStorageFile;
}

export interface Meeting {
  meetingName: string;
  fileName: string;
  meetingUrl: string;
  pdf: MeetingFile;
  json: MeetingFile;
}

export enum LegislatureType {
  วิสามัญ,
  สมัยสามัญประจำปีครั้งที่หนึ่ง,
  สมัยสามัญประจำปีครั้งที่สอง,
  สามัญทั่วไป,
  สามัญนิติบัญญัติ,
  สามัญ,
}

export interface MeetingReport {
  id: string;
  meetingSet: number;
  meetingYear: number;
  legislatureType: string;
  meetingNumber: number;
  meetingName: string[];
  storageFileNamePdf?: string;
  sourceFileName: string;
  sourcePdfUrl: string;
}

export interface MeetingReportUrl {
  meetingId: string;
  meetingName: string[];
  sourceUrl: string;
  fileName: string;
  pdfFileName: string;
  meetingDetail: string[];
}

export interface MeetingHtml {
  sourceUrl: string;
  filePath: string;
}
