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

  constructor(public stateFileName: string) {
    this.readStates();
  }

  updateLastClickFunction(name: string) {
    this.lastClickFunction = name;
  }

  pushMeetingReportUrl(url: T) {
    this.allMeetingReportUrls.push(url);
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

  get states() {
    return {
      lastClickFunction: this.lastClickFunction,
      allMeetingReportUrls: this.allMeetingReportUrls,
      visitedUrls: this.visitedUrls,
      hasErrorUrls: this.hasErrorUrls,
    };
  }

  readStates() {
    if (existsSync(this.stateFileName)) {
      const statesJson = readFileSync(this.stateFileName, "utf-8");
      const states = JSON.parse(statesJson);
      this.lastClickFunction = states.lastClickFunction || "";
      this.allMeetingReportUrls = states.allMeetingReportUrls || [];
      this.visitedUrls = states.visitedUrls || [];
      this.hasErrorUrls = states.hasErrorUrls || [];
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
