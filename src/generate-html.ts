import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";

interface JSONMeetingSession {
  sessionId: string;
  filePath: string;
  sourceUrl: string;
  date: string;
  essembleName: string;
  sessionInfo: string[];
  documents: JSONMeetingDocument[];
}

interface JSONMeetingDocument {
  text: string;
  href: string;
}

const ASSEMBLY_TYPE_NAMES: Record<string, string> = {
  "สภาผู้แทนราษฎร": "House of Representatives",
  "รัฐสภา": "National Assembly",
  "สภานิติบัญญัติแห่งชาติ": "National Legislative Assembly",
  "สภาร่างรัฐธรรมนูญ": "Constitution Drafting Assembly",
  "สภาปฏิรูปแห่งชาติ": "National Reform Council",
  "สภาขับเคลื่อนการปฏิรูปประเทศ": "National Reform Steering Assembly",
};

function escapeHtml(text: string | undefined | null): string {
  if (text == null) {
    return "";
  }
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function generateDocumentLinks(documents: JSONMeetingDocument[] | undefined | null): string {
  if (!documents || documents.length === 0) {
    return "-";
  }
  return documents
    .map((doc) => `<a href="${escapeHtml(doc.href)}">${escapeHtml(doc.text)}</a>`)
    .join(", ");
}

function generateSessionRow(session: JSONMeetingSession): string {
  return `<tr>
<td>${escapeHtml(session.date)}</td>
<td>${escapeHtml(session.sessionId)}</td>
<td>${(session.sessionInfo || []).map(escapeHtml).join(" &gt; ")}</td>
<td>${generateDocumentLinks(session.documents)}</td>
<td><a href="${escapeHtml(session.sourceUrl)}">Source</a></td>
</tr>`;
}

function generateAssemblySection(
  assemblyName: string,
  sessions: JSONMeetingSession[],
  isFirst: boolean
): string {
  const englishName = ASSEMBLY_TYPE_NAMES[assemblyName] || "";
  const openAttr = isFirst ? " open" : "";

  const rows = sessions.map(generateSessionRow).join("\n");

  return `<details${openAttr}>
<summary>${escapeHtml(assemblyName)} (${englishName}) - ${sessions.length} sessions</summary>
<table border="1">
<thead>
<tr>
<th>Date</th>
<th>Session ID</th>
<th>Session Info</th>
<th>Documents</th>
<th>Source</th>
</tr>
</thead>
<tbody>
${rows}
</tbody>
</table>
</details>`;
}

function generateHtml(sessions: JSONMeetingSession[]): string {
  // Group by assembly type
  const groupedSessions = sessions.reduce((acc, session) => {
    if (!acc[session.essembleName]) {
      acc[session.essembleName] = [];
    }
    acc[session.essembleName].push(session);
    return acc;
  }, {} as Record<string, JSONMeetingSession[]>);

  // Sort sessions within each group by date (descending - newest first)
  Object.values(groupedSessions).forEach((group) => {
    group.sort((a, b) => b.date.localeCompare(a.date));
  });

  const assemblyNames = Object.keys(groupedSessions);
  const sections = assemblyNames
    .map((name, idx) => generateAssemblySection(name, groupedSessions[name], idx === 0))
    .join("\n\n");

  const generatedAt = new Date().toISOString();

  return `<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Thai Parliament Meeting Sessions</title>
</head>
<body>
<h1>Thai Parliament Meeting Sessions</h1>
<p>Total: ${sessions.length} sessions</p>
<p>Generated: ${generatedAt}</p>

${sections}
</body>
</html>`;
}

function main() {
  const inputFile = "meeting-sessions.json";
  const outputDir = "docs";
  const outputFile = `${outputDir}/index.html`;

  // Read input data
  const sessions = JSON.parse(
    readFileSync(inputFile, "utf8")
  ) as JSONMeetingSession[];

  console.log(`Read ${sessions.length} sessions from ${inputFile}`);

  // Ensure output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
    console.log(`Created directory: ${outputDir}`);
  }

  // Generate and write HTML
  const html = generateHtml(sessions);
  writeFileSync(outputFile, html, "utf8");

  console.log(`Generated ${outputFile} (${(html.length / 1024).toFixed(1)} KB)`);
}

main();
