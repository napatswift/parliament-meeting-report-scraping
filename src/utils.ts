import { existsSync, writeFileSync, readFileSync } from "fs";

export const convertThaiNumberToArabic = (thaiNumber: string): string => {
  if (thaiNumber === "") {
    return "";
  }
  const thaiNumberToArabicNumber: Record<string, string> = {
    "๐": "0",
    "๑": "1",
    "๒": "2",
    "๓": "3",
    "๔": "4",
    "๕": "5",
    "๖": "6",
    "๗": "7",
    "๘": "8",
    "๙": "9",
  };
  return thaiNumber
    .split("")
    .map((char) => thaiNumberToArabicNumber[char] || char)
    .join("");
};

export class ScraperState<T> {
  allMeetingReportUrls: T[] = [];
  visitedUrls: string[] = [];
  hasErrorUrls: string[] = [];
  lastClickFunction: string = "";
  fileTypeIndex: number = 0;
  fileTypes = [
    "%C3%D2%C2%A7%D2%B9%A1%D2%C3%BB%C3%D0%AA%D8%C1", // รายงานการประชุม
    "%BA%D1%B9%B7%D6%A1%A1%D2%C3%BB%C3%D0%AA%D8%C1", // บันทึกการประชุม
    "%CA%C3%D8%BB%E0%CB%B5%D8%A1%D2%C3%B3%EC", // สรุปเหตุการณ์
    "%BA%D1%B9%B7%D6%A1%A1%D2%C3%CD%CD%A1%E0%CA%D5%C2%A7%C5%A7%A4%D0%E1%B9%B9", // บันทึกการออกเสียงลงคะแนน
    "%BB%C3%D0%C1%C7%C5%A4%D3%C7%D4%B9%D4%A8%A9%D1%C2", // ประมวลคำวินิจฉัย
    "%CA%C3%D8%BB%A1%D2%C3%BB%C3%D0%AA%D8%C1", // สรุปการประชุม
  ];

  constructor(public stateFileName: string) {
    this.readStates();
  }

  updateLastClickFunction(name: string) {
    this.lastClickFunction = name;
  }

  pushMeetingReportUrl(url: T) {
    if (
      this.allMeetingReportUrls.findIndex((u) => {
        // If all keys are the same, then it's the same object
        for (const key in u) {
          if (u[key] !== url[key]) {
            return false;
          }
        }
        return true;
      }) === -1
    ) {
      this.allMeetingReportUrls.push(url);
    }
  }

  pushVisitedUrl(url: string) {
    this.visitedUrls.push(url);
  }

  hasVisitedUrl(url: string) {
    return this.visitedUrls.includes(url);
  }

  pushHasErrorUrl(url: string) {
    this.hasErrorUrls.push(url);
  }

  hasErrorUrl(url: string) {
    return this.hasErrorUrls.includes(url);
  }

  removeErrorUrl(url: string) {
    this.hasErrorUrls = this.hasErrorUrls.filter((u) => u !== url);
  }

  clearStates() {
    this.visitedUrls = [];
    this.hasErrorUrls = [];
    this.lastClickFunction = "";
    this.fileTypeIndex = (this.fileTypeIndex + 1) % this.fileTypes.length;
  }

  get states() {
    return {
      fileType: this.fileTypeIndex,
      lastClickFunction: this.lastClickFunction,
      allMeetingReportUrls: this.allMeetingReportUrls,
      visitedUrls: this.visitedUrls,
      hasErrorUrls: this.hasErrorUrls,
    };
  }

  get fileType() {
    return this.fileTypes[this.fileTypeIndex] || "";
  }

  readStates() {
    if (existsSync(this.stateFileName)) {
      const statesJson = readFileSync(this.stateFileName, "utf-8");
      const states = JSON.parse(statesJson);
      this.lastClickFunction = states.lastClickFunction || "";
      this.allMeetingReportUrls = states.allMeetingReportUrls || [];
      this.visitedUrls = states.visitedUrls || [];
      this.hasErrorUrls = states.hasErrorUrls || [];
      this.fileTypeIndex = states.fileType || 0;
    }
  }

  saveFile() {
    return writeFileSync(
      this.stateFileName,
      JSON.stringify(this.states, null, 2),
      "utf-8"
    );
  }
}
