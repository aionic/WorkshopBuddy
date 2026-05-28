import {
  AlignmentType,
  Document,
  Footer,
  HeadingLevel,
  PageNumber,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableCell,
  TableRow,
  WidthType
} from "docx";
import type { ArtifactContent } from "./artifact-schemas";

type HeadingLevelValue = (typeof HeadingLevel)[keyof typeof HeadingLevel];
type AlignmentTypeValue = (typeof AlignmentType)[keyof typeof AlignmentType];

function p(text: string, opts: { bold?: boolean; size?: number; heading?: HeadingLevelValue; align?: AlignmentTypeValue } = {}) {
  return new Paragraph({
    heading: opts.heading,
    alignment: opts.align,
    children: [new TextRun({ text, bold: opts.bold, size: opts.size })]
  });
}

function paragraphsFromContent(text: string): Paragraph[] {
  const blocks = text.split(/\n{2,}/);
  const out: Paragraph[] = [];
  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;
    const bulletLines = trimmed.split("\n").filter((l) => /^[-*]\s+/.test(l));
    if (bulletLines.length && bulletLines.length === trimmed.split("\n").length) {
      for (const line of bulletLines) {
        out.push(
          new Paragraph({
            bullet: { level: 0 },
            children: [new TextRun(line.replace(/^[-*]\s+/, ""))]
          })
        );
      }
    } else {
      out.push(new Paragraph({ children: [new TextRun(trimmed)] }));
    }
  }
  return out;
}

function metricsTable(metrics: NonNullable<ArtifactContent["metrics"]>): Table {
  const header = new TableRow({
    tableHeader: true,
    children: ["Metric", "Value", "Notes"].map(
      (h) =>
        new TableCell({
          width: { size: 33, type: WidthType.PERCENTAGE },
          children: [p(h, { bold: true })]
        })
    )
  });
  const rows = metrics.map(
    (m) =>
      new TableRow({
        children: [
          new TableCell({ children: [p(m.label)] }),
          new TableCell({ children: [p(m.value, { bold: true })] }),
          new TableCell({ children: [p(m.subtext ?? "")] })
        ]
      })
  );
  return new Table({ rows: [header, ...rows], width: { size: 100, type: WidthType.PERCENTAGE } });
}

export async function renderDocx(content: ArtifactContent, artifactType: string, version: number): Promise<Buffer> {
  const children: Array<Paragraph | Table> = [];
  children.push(p(content.title, { heading: HeadingLevel.TITLE, align: AlignmentType.LEFT }));
  if (content.subtitle) children.push(p(content.subtitle, { heading: HeadingLevel.HEADING_3 }));
  children.push(p(""));

  if (content.metrics && content.metrics.length) {
    children.push(p("Headline Metrics", { heading: HeadingLevel.HEADING_1 }));
    children.push(metricsTable(content.metrics));
    children.push(p(""));
  }

  for (const s of content.sections) {
    children.push(p(s.heading, { heading: HeadingLevel.HEADING_1 }));
    children.push(...paragraphsFromContent(s.content));
  }

  if (content.nextSteps?.length) {
    children.push(p("Recommended Next Steps", { heading: HeadingLevel.HEADING_1 }));
    for (const n of content.nextSteps) {
      children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(n)] }));
    }
  }

  if (content.assumptions?.length) {
    children.push(p("Assumptions and Inputs Used", { heading: HeadingLevel.HEADING_1 }));
    for (const a of content.assumptions) {
      children.push(new Paragraph({ bullet: { level: 0 }, children: [new TextRun(a)] }));
    }
  }

  const doc = new Document({
    creator: "Workshop Buddy",
    title: content.title,
    description: artifactType,
    sections: [
      {
        properties: {},
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun(`Workshop Buddy  •  ${artifactType}  •  v${version}  •  Page `),
                  new TextRun({ children: [PageNumber.CURRENT] })
                ]
              })
            ]
          })
        },
        children
      }
    ]
  });

  return await Packer.toBuffer(doc);
}
