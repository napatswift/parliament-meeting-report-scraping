import { JSDOM } from "jsdom";
import {
  ScraperState,
  convertThaiNumberToArabic,
  findLastIndex,
} from "./utils";
import { MeetingHtml } from "./types";
import { readFileSync, writeFileSync, existsSync } from "fs";

interface AssemblySession {
  date: string;
  essembleName: any;
  sessionInfo: string[];
  sourceUrl: string;
  documents: any[];
  description?: string;
  descriptionDocuments?: any[];
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
>(sessions: T[]): void {
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
>(sessions: T[]): void {
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
      /(\d+)\s+(มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม|ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.)\.?\s+(พ\.ศ\.\s*)?(\d+)/g
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
  const tableRows = Array.from(table.rows);
  for (const row of tableRows) {
    if (!fileStarted && row.textContent.trim() === "ข้อมูลการประชุม") {
      fileStarted = true;
    }
    if (fileStarted) {
      Array.from(row.getElementsByTagName("a"))
        .filter(
          (a: HTMLAnchorElement) => a.href && !a.href.startsWith("about:blank")
        )
        .map((a: HTMLAnchorElement) => {
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

const PUBLIC_REPORT_BASE =
  "https://msbis.parliament.go.th/ewtadmin/ewt/parliament_report/";
const BLOCK_TAGS = new Set([
  "DIV", "P", "LI", "UL", "OL", "TR", "TD", "TABLE",
  "H1", "H2", "H3", "H4", "H5", "H6",
]);
const GENERIC_LABEL = /^[\s\-–]*\(?\s*(ดู)?(ผลการลงมติ|ตรวจสอบองค์ประชุม|การตรวจสอบองค์ประชุม)?\s*\)?[\s\-–]*$/;

function cleanText(text: string) {
  return text.replace(/[\u00a0\s]+/g, " ").trim();
}

// Some links point at internal hosts (e.g. http://10.156.7.199/vote/...) that
// are unreachable from outside; the same file lives on the public host under
// download/.
function normalizeHref(url: URL) {
  const internal =
    /^(10|192\.168|172\.(1[6-9]|2\d|3[01]))\./.test(url.hostname) ||
    url.hostname === "fimsbis.parliament.go.th";
  if (!internal) return url.toString();
  const path = url.pathname.replace(/^\/+/, "").replace(/^.*?(download\/)?(vote\/)/, "$1$2");
  return new URL(
    (path.startsWith("download/") ? "" : "download/") + path + url.search,
    PUBLIC_REPORT_BASE
  ).toString();
}

// The agenda item a link belongs to is the text just before it: the last
// non-trivial block, starting from its last "- " line (items are often
// wrapped across <br>-separated lines).
function pickSubject(blocks: string[][]) {
  const nonTrivial = blocks
    .map((lines) =>
      lines.filter((line) => {
        const t = cleanText(line);
        return !/^[-–—•.\s]*$/.test(t) && t !== "ใบประมวลผล";
      })
    )
    .filter((lines) => lines.length > 0);
  const last = nonTrivial[nonTrivial.length - 1];
  if (!last) return "";
  let start = 0;
  last.forEach((line, i) => {
    if (/^[-–]/.test(cleanText(line))) start = i;
  });
  // Join wrapped lines without adding spaces: <br> often splits Thai text
  // mid-word, so only the whitespace already in the source is kept.
  return cleanText(last.slice(start).join("").trim().replace(/^[-–]\s*/, ""));
}

// The hidden "เรื่องที่พิจารณา" row (tr#mydetail) holds a description of the
// agenda, which may contain links to related documents (e.g. vote results).
function extractDescription(doc: Document, meeting: MeetingHtml) {
  const row = doc.getElementById("mydetail");
  if (!row) return { description: "", descriptionDocuments: [] };

  const sourceUrl = new URL(meeting.sourceUrl);
  const links = new Array<{ label: string; href: string; subject: string }>();

  let blocks: string[][] = [[""]];
  let lastSubject = "";
  const newBlock = () => blocks.push([""]);
  const newLine = () => blocks[blocks.length - 1].push("");

  const walk = (node: Node) => {
    if (node.nodeType === 3) {
      const lines = blocks[blocks.length - 1];
      lines[lines.length - 1] += node.textContent;
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    if (el.tagName === "BR") return newLine();
    if (el.tagName === "A") {
      const raw = el.getAttribute("href")?.trim();
      if (!raw || raw.startsWith("#") || raw.startsWith("javascript:")) return;
      const subject = pickSubject(blocks) || lastSubject;
      lastSubject = subject;
      blocks = [[""]];
      links.push({
        label: cleanText(el.textContent ?? "").replace(/^[-–]\s*/, ""),
        href: normalizeHref(new URL(raw, sourceUrl)),
        subject,
      });
      return;
    }
    const isBlock = BLOCK_TAGS.has(el.tagName);
    if (isBlock) newBlock();
    el.childNodes.forEach(walk);
    if (isBlock) newBlock();
  };
  row.childNodes.forEach(walk);

  // Same file linked twice (e.g. a "-" anchor and a labelled one): keep one,
  // preferring the one with a label.
  const byHref = new Map<string, (typeof links)[number]>();
  for (const link of links) {
    const prev = byHref.get(link.href);
    if (!prev || (!prev.label && link.label)) byHref.set(link.href, link);
  }

  const named = Array.from(byHref.values()).map((link) => {
    const fileId = new URL(link.href).pathname.split("/").pop()!.replace(/\.\w+$/, "");
    const label = GENERIC_LABEL.test(link.label)
      ? link.label.replace(/^[\s\-–(]+(ดู)?|[\s)]+$/g, "") ||
        (/\/vote\//.test(link.href) ? "ผลการลงมติ" : fileId)
      : link.label;
    const subject =
      link.subject.length > 300 ? `${link.subject.slice(0, 300)}…` : link.subject;
    const text = subject && !subject.includes(label) ? `${subject} - ${label}` : subject || label;
    return { text, label: link.label, href: link.href, fileId };
  });

  // Make names unique within a session
  const seen = new Map<string, number>();
  named.forEach((d) => seen.set(d.text, (seen.get(d.text) ?? 0) + 1));
  const descriptionDocuments = named.map(({ fileId, ...d }) =>
    seen.get(d.text)! > 1 ? { ...d, text: `${d.text} (${fileId})` } : d
  );

  const description = (row.textContent ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();

  return { description, descriptionDocuments };
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

  let meetingDates = extractDates(convertThaiNumberToArabic(date));

  // Some dates omit the year after the month, e.g. "ครั้งที่ 8/2475 วันศุกร์ที่ 15 กรกฎาคม";
  // fall back to the year in the meeting number
  const meetingYear = convertThaiNumberToArabic(date).match(/\/\s*(\d{4})/);
  if (meetingDates.length === 0 && meetingYear) {
    meetingDates = extractDates(
      `${convertThaiNumberToArabic(date)} ${meetingYear[1]}`
    );
  }

  return {
    date: meetingDates[0],
    essembleName: ESSEMBLE_TYPES[essembleName],
    sessionInfo,
    sourceUrl: meeting.sourceUrl,
    documents,
    ...extractDescription(doc, meeting),
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
        findLastIndex(self, (m) => m.sourceUrl === meeting.sourceUrl) === index
      );
    })
    // .slice(0, 500)
    .map((report: MeetingHtml): AssemblySession => {
      const existingData = prevParsedData.find(
        (existingReport) =>
          existingReport.sourceUrl === report.sourceUrl &&
          existingReport.filePath === report.filePath
      );
      // Re-parse only the date for cached sessions missing one
      if (existingData && !existingData.date)
        return { ...existingData, date: parse(report).date };
      // Backfill the description for sessions cached before it was extracted
      if (existingData && existingData.descriptionDocuments?.some((d: any) => d.label === undefined) !== false) {
        const { description, descriptionDocuments } = parse(report);
        return { ...existingData, description, descriptionDocuments };
      }
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

  console.log(
    "Meeting with invalid id: ",
    prevParsedData.filter(
      (report) => report.sessionId.match(/^\d+(\.[\d@#]+)+$/) === null
    )
  );

  writeFileSync("meeting-sessions.json", JSON.stringify(sortedData, null, 2));
}

main();
