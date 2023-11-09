import { JSDOM } from "jsdom";
import { ScraperState, convertThaiNumberToArabic } from "./utils";
import { MeetingHtml } from "./types";
import { readFileSync, writeFileSync, existsSync } from "fs";

interface AssemblySession {
  date: string;
  essembleName: any;
  sessionInfo: string[];
  sourceUrl: string;
  documents: any[];
  filePath: string;
  sessionId: string;
}

function readHtml(filePath: string) {
  const html = readFileSync(filePath, "utf-8");
  const dom = new JSDOM(html);
  return dom.window.document;
}

function specialAssemblyId<
  T extends { sessionInfo: string[]; sessionId: string }
>(session: T): T {
  if (session.sessionInfo.length !== 3) {
    throw new Error("expect 3 sessionInfo");
  }
  const year = session.sessionInfo[1].replace(/^ปี\s+(\d+)/, "$1");
  const number = session.sessionInfo[2]
    .replace(/^ครั้งที่\s+(\d+(\/\d+)?).*$/, "$1")
    .replace(/\//, "@");
  return {
    ...session,
    sessionId: `${year}.${number}`,
  };
}

function generateParliamentMeetingId<
  T extends { sessionInfo: string[]; sessionId: string }
>(sessions: T[]): undefined {
  if (!sessions.every((session) => session.sessionInfo.length === 5)) {
    throw new Error("expect 5 sessionInfo");
  }

  const subYearGroupedByYear = sessions.reduce(
    (acc: { [key: string]: Array<string> }, session) => {
      const meetingSet = session.sessionInfo[1].replace(/^ชุดที่\s+/, "");
      const meetingYear = session.sessionInfo[2].replace(/^ปีที่\s+/, "");
      const meetingSubYear = session.sessionInfo[3];
      const year = `${meetingSet}.${meetingYear}`;
      if (acc[year] === undefined) {
        acc[year] = new Array<string>();
      }
      if (!acc[year].includes(meetingSubYear)) acc[year].push(meetingSubYear);
      return acc;
    },
    {}
  );

  for (const session of sessions) {
    if (session.sessionId !== "") continue;
    const meetingSet = session.sessionInfo[1].replace(/^ชุดที่\s+/, "");
    const meetingYear = session.sessionInfo[2].replace(/^ปีที่\s+/, "");
    const meetingSubYear = session.sessionInfo[3];
    const meetingNumber = session.sessionInfo[4]
      .replace(/^ครั้งที่\s+(\d+(\/\d+)?).*$/, "$1")
      .replace(/\//, "@");
    const year = meetingSet + "." + meetingYear;
    const subYearIdx = subYearGroupedByYear[year].indexOf(meetingSubYear);
    session.sessionId = `${meetingSet}.${meetingYear}.${subYearIdx}.${meetingNumber}`;
  }
}

function generateNationalAssemblyId<
  T extends { sessionInfo: string[]; sessionId: string }
>(sessions: T[]): undefined {
  if (!sessions.every((session) => session.sessionInfo.length === 4)) {
    throw new Error("expect 4 sessionInfo");
  }

  const subYearGroupedByYear = sessions.reduce(
    (acc: { [key: string]: Array<string> }, session) => {
      const meetingYear = session.sessionInfo[1].replace(/^ปี\s+(\d+).*/, "$1");
      const meetingSubYear = session.sessionInfo[2];
      if (acc[meetingYear] === undefined) {
        acc[meetingYear] = new Array<string>();
      }
      if (!acc[meetingYear].includes(meetingSubYear))
        acc[meetingYear].push(meetingSubYear);
      return acc;
    },
    {}
  );

  for (const session of sessions) {
    if (session.sessionId !== "") continue;
    const meetingYear = session.sessionInfo[1].replace(/^ปี\s+(\d+).*/, "$1");
    const meetingSubYear = session.sessionInfo[2];
    const meetingNumber = session.sessionInfo[3]
      .replace(/^ครั้งที่\s+(\d+(\/\d+)?).*$/, "$1")
      .replace(/\//, "-");
    const subYearIdx =
      subYearGroupedByYear[meetingYear].indexOf(meetingSubYear);
    session.sessionId = `${meetingYear}.${subYearIdx}.${meetingNumber}`;
  }
}

const MONTH_TH_TO_NUMBER = {
  มกราคม: 1,
  "ม.ค.": 1,
  กุมภาพันธ์: 2,
  "ก.พ.": 2,
  มีนาคม: 3,
  "มี.ค.": 3,
  เมษายน: 4,
  "เม.ย.": 4,
  พฤษภาคม: 5,
  "พ.ค.": 5,
  มิถุนายน: 6,
  "มิ.ย.": 6,
  กรกฎาคม: 7,
  "ก.ค.": 7,
  สิงหาคม: 8,
  "ส.ค.": 8,
  กันยายน: 9,
  "ก.ย.": 9,
  ตุลาคม: 10,
  "ต.ค.": 10,
  พฤศจิกายน: 11,
  "พ.ย.": 11,
  ธันวาคม: 12,
  "ธ.ค.": 12,
};

function extractDates(text: string) {
  const matches = text
    .replace("กรกฏาคม", "กรกฎาคม")
    .replace("กรกฎาค ม", "กรกฎาคม ")
    .matchAll(
      /(\d+)\s+(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม|ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)\s+(พ\.ศ\.\s*)?(\d+)/g
    );

  const dates = new Array<string>();

  for (const match of matches) {
    const day = match[1];
    const month: number = MONTH_TH_TO_NUMBER[match[2]];
    if (!month) {
      throw new Error(`month not found: ${match[2]}`);
    }
    const year = parseInt(match[4]) - 543; // Gregorian calendar
    dates.push(
      `${year}` +
        `-${month.toString().padStart(2, "0")}` +
        `-${day.toString().padStart(2, "0")}`
    );
  }

  return dates;
}

function extractDataUrls(table: HTMLTableElement, meeting: MeetingHtml) {
  const fileUrls = [];
  let fileStarted = false;
  for (const row of table.rows) {
    if (!fileStarted && row.textContent.trim() === "ข้อมูลการประชุม") {
      fileStarted = true;
    }
    if (fileStarted) {
      Array.from(row.getElementsByTagName("a"))
        .filter((a) => a.href && !a.href.startsWith("about:blank"))
        .map((a) => {
          return {
            text: a.textContent,
            href: a.href,
          };
        })
        // concat with the links from sourceUrl
        .map((link) => {
          const href = link.href;
          const sourceUrl = new URL(meeting.sourceUrl);
          const url = new URL(href, sourceUrl);
          return {
            text: link.text,
            href: url.toString(),
          };
        })
        .forEach((link) => fileUrls.push(link));
    }
  }

  return fileUrls;
}

const ESSEMBLE_TYPES = {
  สภาร่างรัฐธรรมนูญ: "สภาร่างรัฐธรรมนูญ",
  สภาปฏิรูปแห่งชาติ: "สภาปฏิรูปแห่งชาติ",
  สภาขับเคลื่อนการปฏิรูปประเทศ: "สภาขับเคลื่อนการปฏิรูปประเทศ",
  สภานิติบัญญัติแห่งชาติ: "สภานิติบัญญัติแห่งชาติ",
  ข้อมูลการประชุมสภานิติบัญญัติ: "สภานิติบัญญัติแห่งชาติ",
  ข้อมูลการประชุมสภาผู้แทนราษฎร: "สภาผู้แทนราษฎร",
  การประชุมสภาร่างรัฐธรรมนูญ: "สภาร่างรัฐธรรมนูญ",
  ข้อมูลการประชุมร่วมกันของรัฐสภา: "รัฐสภา",
  ข้อมูลการประชุมสภาปฏิรูปแห่งชาติ: "สภาปฏิรูปแห่งชาติ",
};

function getEssembleName(subnames: string[]) {
  for (const meetingType in ESSEMBLE_TYPES) {
    if (subnames.includes(meetingType)) {
      return meetingType;
    }
  }

  throw new Error(`meetingType not found in ${subnames}`);
}

function parse(meeting: MeetingHtml) {
  const doc = readHtml(meeting.filePath);

  const table = doc.querySelector("table");

  if (!table) {
    throw new Error("table not found");
  }

  const subnameLinks = Array.from(table.rows[1].getElementsByTagName("a"));
  const subnames = subnameLinks.map((link) => link.textContent.trim());
  const date = table.rows[2].textContent.trim();

  const essembleName = getEssembleName(subnames);
  const essembleIdx = subnames.indexOf(essembleName);

  const sessionInfo = [...subnames.slice(essembleIdx), date].map(
    convertThaiNumberToArabic
  );

  const documents = extractDataUrls(table, meeting);

  const meetingDates = extractDates(convertThaiNumberToArabic(date));

  return {
    date: meetingDates[0],
    essembleName: ESSEMBLE_TYPES[essembleName],
    sessionInfo,
    sourceUrl: meeting.sourceUrl,
    documents,
  };
}

function getRootId(id: string) {
  return id.replace(/#\d+$/, "");
}

function main() {
  const parsedDataFilePath = "meeting-sessions.json";

  const prevParsedData = new Array<AssemblySession>();
  if (existsSync(parsedDataFilePath)) {
    JSON.parse(readFileSync(parsedDataFilePath, "utf-8")).forEach(
      (report: AssemblySession) => {
        prevParsedData.push(report);
      }
    );
  }
  const state = new ScraperState<MeetingHtml>("html-scraper-states-all.json");

  console.table({
    total: state.allMeetingReportUrls.length,
    unique: state.allMeetingReportUrls.filter(
      (meeting, index, self) =>
        self.findIndex((m) => m.sourceUrl === meeting.sourceUrl) === index
    ).length,
  });

  console.debug("duplicate urls:");
  console.debug(
    state.allMeetingReportUrls.filter(
      (meeting, index, self) =>
        self.findIndex((m) => m.sourceUrl === meeting.sourceUrl) !== index
    )
  );

  console.debug("parsing meeting report urls ...");

  const parsedData = state.allMeetingReportUrls
    .filter((meeting, index, self) => {
      return (
        self.findLastIndex((m) => m.sourceUrl === meeting.sourceUrl) === index
      );
    })
    // .slice(0, 500)
    .map((report: MeetingHtml): AssemblySession => {
      const existingData = prevParsedData.find(
        (existingReport) =>
          existingReport.sourceUrl === report.sourceUrl &&
          existingReport.filePath === report.filePath
      );
      if (existingData) return existingData;
      return {
        sessionId: "",
        ...report,
        ...parse(report),
      };
    })
    .map((report) => {
      if (report.sessionId !== "") return report;
      if (
        report.essembleName === "สภาร่างรัฐธรรมนูญ" ||
        report.essembleName === "สภาปฏิรูปแห่งชาติ" ||
        report.essembleName === "สภานิติบัญญัติแห่งชาติ" ||
        report.essembleName === "สภาขับเคลื่อนการปฏิรูปประเทศ"
      ) {
        return specialAssemblyId(report);
      }
      return report;
    });

  // Parliament meeting id
  generateParliamentMeetingId(
    parsedData.filter((report) => report.essembleName === "สภาผู้แทนราษฎร")
  );

  // National essemble (รัฐสภา) id
  generateNationalAssemblyId(
    parsedData.filter((report) => report.essembleName === "รัฐสภา")
  );

  const sortedData = parsedData.sort((a, b) => {
    if (a.date === undefined && b.date !== undefined) return 1;
    if (a.date !== undefined && b.date === undefined) return -1;
    if (a.date !== undefined && b.date !== undefined)
      return a.date.localeCompare(b.date);
    else return 0;
  });

  console.debug("Stats:");
  console.table(
    parsedData.reduce(
      (acc, cur) => {
        if (acc[cur.essembleName] === undefined) {
          acc[cur.essembleName] = 0;
        } else {
          acc[cur.essembleName]++;
        }
        acc.total++;
        return acc;
      },
      { total: 0 }
    )
  );
  console.log(
    "Meeting without Id:",
    parsedData.filter((report) => report.sessionId === "").length
  );

  // Fix duplicated id
  parsedData
    .filter(
      (report, index, self) =>
        self.findIndex(
          (m) =>
            getRootId(m.sessionId) === getRootId(report.sessionId) &&
            m.essembleName === report.essembleName
        ) !== index
    )
    .map((report) => getRootId(report.sessionId))
    .forEach((id) => {
      const duplicatedData = parsedData.filter(
        (report) => getRootId(report.sessionId) === id
      );

      const maxSubId = Math.max(
        ...duplicatedData.map((report) => {
          if (report.sessionId.match(/#\d+$/))
            return parseInt(report.sessionId.replace(/^.*#/, ""));
          return 0;
        })
      );

      duplicatedData
        .filter((report) => report.sessionId.match(/#\d+$/) === null)
        .forEach((report, index) => {
          report.sessionId = `${getRootId(report.sessionId)}#${
            index + maxSubId + 1
          }`;
        });
    });

  writeFileSync("meeting-sessions.json", JSON.stringify(sortedData, null, 2));
}

main();
