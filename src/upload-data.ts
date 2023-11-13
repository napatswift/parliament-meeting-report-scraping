import { readFileSync } from "fs";
import { PrismaClient, Prisma } from "@prisma/client";

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

async function main() {
  const prisma = new PrismaClient({
    // log: ["query", "info", "warn"],
  });

  const meetingSessions = JSON.parse(
    readFileSync("meeting-sessions.json", "utf8")
  ) as JSONMeetingSession[];

  console.log("meetingSessions", meetingSessions.length);

  for (const meetingSession of meetingSessions) {
    const { sessionId, sourceUrl, date, essembleName, sessionInfo } =
      meetingSession;

    const existWithDifferentId = await prisma.meetingSession.findFirst({
      where: {
        sourceUrl: sourceUrl,
        NOT: {
          id: {
            equals: sessionId,
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (existWithDifferentId) {
      console.log(
        "existWithDifferentId",
        existWithDifferentId,
        sessionId,
        sourceUrl
      );
      // Update id
      await prisma.meetingSession.update({
        where: {
          sourceUrl: sourceUrl,
        },
        data: {
          id: sessionId,
        },
      });
    }

    const isoDate = new Date(date).toISOString();

    const data: Prisma.MeetingSessionCreateInput = {
      essemblyType: meetingSession.essembleName,
      id: sessionId,
      sourceUrl: sourceUrl,
      startAt: isoDate,
      meetingCategoriesOnMeetingSessions: {
        connectOrCreate: sessionInfo
          .map((info) => info.replace(/\s+/g, " ").trim())
          .map(
            (
              category,
              idx
            ): Prisma.MeetingCategoriesOnMeetingSessionsCreateOrConnectWithoutMeetingSessionInput => {
              return {
                where: {
                  meetingSessionEssemblyType_meetingSessionId_meetingCategoryName:
                    {
                      meetingCategoryName: category,
                      meetingSessionId: sessionId,
                      meetingSessionEssemblyType: essembleName,
                    },
                },
                create: {
                  meetingCategory: {
                    connectOrCreate: {
                      where: {
                        categoryName: category,
                      },
                      create: {
                        categoryName: category,
                        order: idx,
                        updatedAt: new Date(),
                      },
                    },
                  },
                },
              };
            }
          ),
      },
      updatedAt: new Date(),
      meetingDocuments: {
        connectOrCreate: meetingSession.documents.map(
          (
            document,
            idx
          ): Prisma.MeetingDocumentCreateOrConnectWithoutMeetingSessionInput => {
            return {
              where: {
                meetingSessionEssemblyType_meetingSessionId_id: {
                  id: idx,
                  meetingSessionEssemblyType: essembleName,
                  meetingSessionId: sessionId,
                },
              },
              create: {
                id: idx,
                documentName: document.text,
                sourceUrl: document.href,
                updatedAt: new Date(),
              },
            };
          }
        ),
      },
    };

    await prisma.meetingSession.upsert({
      where: {
        essemblyType_id: {
          id: sessionId,
          essemblyType: essembleName,
        },
      },
      update: {},
      create: data,
    });
  }

  await prisma.$disconnect();
}

main();
