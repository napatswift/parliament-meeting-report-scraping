import { JSDOM } from "jsdom";
import { ScraperState, convertThaiNumberToArabic } from "./utils";
import { MeetingHtml } from "./types";
import { readFileSync, writeFileSync } from "fs";

const state = new ScraperState<MeetingHtml>("html-scraper-states-all.json");

function readHtml(filePath: string) {
  const html = readFileSync(filePath, "utf-8");
  const dom = new JSDOM(html);
  return dom.window.document;
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

console.debug("No. of meeting report urls:", state.allMeetingReportUrls.length);
console.debug("parsing meeting report urls ...");

writeFileSync(
  "meeting-sessions.json",
  JSON.stringify(
    state.allMeetingReportUrls
      // .slice(0, 10)
      .map((report: MeetingHtml) => {
        try {
          return {
            ...report,
            ...parse(report),
          };
        } catch (error) {
          // console.error(report.filePath, error.message);
          return {
            ...report,
            error: error.message,
          };
        }
      })
      .sort((a, b) => {
        if (
          "error" in a &&
          a.error !== undefined &&
          "error" in b &&
          b.error !== undefined
        )
          return 0;

        if ("error" in a && a.error !== undefined) return 1;
        if ("error" in b && b.error !== undefined) return -1;

        if ("date" in a && a.date !== undefined && !("date" in b)) return -1;
        if (!("date" in a) && "date" in b && b.date !== undefined) return 1;
        if ("date" in a && "date" in b) {
          if (a.date === undefined && b.date !== undefined) return 1;
          if (a.date !== undefined && b.date === undefined) return -1;
          if (a.date !== undefined && b.date !== undefined)
            return a.date.localeCompare(b.date);
          else return 0;
        }
        return 0;
      }),
    null,
    2
  )
);
