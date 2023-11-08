import { existsSync, mkdirSync, writeFileSync } from "fs";
import { ScraperState } from "./utils";
import puppeteer, { Page } from "puppeteer";
import { MeetingHtml } from "./types";

const year: string =
  process.argv[2] && process.argv[2] !== "all" ? process.argv[2] : "all";
console.debug(`year: "${year}"`);

const isActionWorkflow = process.env.NODE_ENV === "gh-actions";
console.debug(`isActionWorkflow=${isActionWorkflow}`);

const SCRAPER_STATES_FILE = `html-scraper-states-${year}.json`;
const MAX_PAGE_PER_RUN = 10;

const htmlDirectory = "downloaded-html";

if (!existsSync(htmlDirectory)) {
  console.debug(`Creating directory ${htmlDirectory}`);
  mkdirSync(htmlDirectory);
}

async function findLinksInPage(page: Page) {
  return await page.$$eval("a", (els) => {
    const anchors = els
      .map((el) => el as HTMLAnchorElement)
      .filter((el) => el.textContent === "ดูเอกสารที่เกี่ยวข้องทั้งหมด");
    return anchors.map((anchor) => anchor.href);
  });
}

async function waitForPageContent(page: Page) {
  await page.waitForSelector("#show_datawarehouse > table > tbody");
}

function hashString(str: string) {
  let hash = 0;

  if (str.length === 0) return hash;

  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }

  return hash;
}

async function meetingDetailHtml(page: Page) {
  await page.waitForSelector("#show_datawarehouse");
  return await page.$eval("#show_datawarehouse > table", (el) => el.outerHTML);
}

function abs(number: number) {
  return number < 0 ? number * -1 : number;
}

async function saveHTML(content: string, header?: string) {
  const hashValue = abs(hashString(content));

  const htmlFilename = `${hashValue}.html`;
  const subDir = `${htmlDirectory}/${abs(hashValue % 100)}`;

  if (!existsSync(subDir)) {
    console.debug(`Creating directory ${subDir}`);
    mkdirSync(subDir);
  }

  const htmlPath = `${subDir}/${htmlFilename}`;

  if (!existsSync(htmlPath)) {
    writeFileSync(htmlPath, header ? header + content : content);
    console.debug(`Saved HTML to ${htmlPath}`);
  } else {
    console.debug(`HTML already exists at ${htmlPath}`);
  }

  return { htmlFilename, htmlPath };
}

const scraper = async () => {
  const browser = await puppeteer.launch({ slowMo: 10 });
  const page = (await browser.pages()).at(0);

  const scraperState = new ScraperState<MeetingHtml>(SCRAPER_STATES_FILE);

  const pageUrl =
    "https://msbis.parliament.go.th/ewtadmin/ewt/parliament_report/main_warehouse.php" +
    `?as_q=&as_epq=&as_oq=&as_eq=&ids=&yearno=${year === "all" ? "" : year}` +
    "&year=&num=&session_id=&as_filetype=&" +
    `as_type=${scraperState.fileType}&Submit=%A4%E9%B9%CB%D2..` +
    "&filename=index&type=6&formtype=advancedS";

  await page.goto(pageUrl);

  await waitForPageContent(page);

  if (scraperState.lastClickFunction) {
    // run the last click function
    await page
      .$eval(
        "a[href='##S']", // selector
        (el, lastClickFunction) => eval(lastClickFunction), // DOM element
        scraperState.lastClickFunction
      )
      .then(() =>
        console.log(`Run lastClickFunction "${scraperState.lastClickFunction}"`)
      );
    await waitForPageContent(page);
  }

  let pageCounter = 0;
  const newPage = await browser.newPage();
  await page.bringToFront();
  while (pageCounter < MAX_PAGE_PER_RUN && page.$("a[href='##S']")) {
    console.debug("pageCounter", pageCounter);

    const links = await findLinksInPage(page);

    console.debug("found links:", links.length);

    const filteredLinks = links.filter(
      (link) =>
        !scraperState.hasVisitedUrl(link) && !scraperState.hasErrorUrl(link)
    );

    console.debug("filtered links:", filteredLinks.length);

    if (filteredLinks.length > 0) {
      await newPage.bringToFront();

      for (const meetingUrl of filteredLinks) {
        try {
          console.debug("Visiting...", meetingUrl);

          await newPage.goto(meetingUrl);

          scraperState.pushVisitedUrl(meetingUrl);

          await waitForPageContent(newPage);

          const htmlContent = await meetingDetailHtml(newPage);
          const header = `<!--
  source: ${meetingUrl}
  date: ${new Date().toISOString()}
-->
`;
          const data = await saveHTML(htmlContent, header);

          scraperState.pushMeetingReportUrl({
            filePath: data.htmlPath,
            sourceUrl: meetingUrl,
          });
          scraperState.removeErrorUrl(meetingUrl);
        } catch (error) {
          console.error(error.message);
          scraperState.pushHasErrorUrl(meetingUrl);
        } finally {
          scraperState.saveFile();
        }
      }

      scraperState.saveFile();
      await new Promise((resolve) => setTimeout(resolve, 3000));
      await page.bringToFront();
    } else {
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    pageCounter++;

    if (await page.$("a[href='##S']")) {
      const onClickOfAnchor = await page.$eval(
        "a[href='##S']", // selector
        (el) => el.getAttribute("onClick") // DOM element
      );

      scraperState.updateLastClickFunction(onClickOfAnchor);
      console.debug("lastClickFunction", scraperState.lastClickFunction);
      scraperState.saveFile();
    } else {
      // Reset lastClickFunction
      scraperState.clearStates();
      scraperState.saveFile();
      break;
    }

    await page.$eval("a[href='##S']", (el: HTMLAnchorElement) => el.click());

    await waitForPageContent(page);
  }

  scraperState.saveFile();
  await browser.close();

  // Stats
  const stats = {
    total: scraperState.allMeetingReportUrls.length,
    unique: scraperState.allMeetingReportUrls.filter(
      (meeting, index, self) =>
        self.findIndex((m) => m.sourceUrl === meeting.sourceUrl) === index
    ).length,
  };

  console.table(stats);
};

scraper();
