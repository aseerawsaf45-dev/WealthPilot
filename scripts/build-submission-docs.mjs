/**
 * Builds the competition Word documents in submission/ from the Markdown sources in docs/ and README.md.
 *   npm run docs:build
 * Edit submission/meta.json (live URL, team, members) and re-run: the values are written into the
 * Markdown (between <!-- meta:key --> markers) and into every .docx cover page.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, Footer, Header, HeadingLevel, ImageRun, LevelFormat, PageBreak,
  PageNumber, PageOrientation, Packer, Paragraph, ShadingType, Table, TableCell, TableLayoutType, TableOfContents, TableRow, TextRun, WidthType,
} from 'docx';

const META_FILE = 'submission/meta.json';
const meta = JSON.parse(fs.readFileSync(META_FILE, 'utf8'));
const NAVY = '1E3A8A';
const INK = '0F172A';
const MUTED = '64748B';

// ---- meta → Markdown (idempotent) -------------------------------------------------------
// Empty values never overwrite what is already in the Markdown (the README may be edited by hand).
const metaValue = (key) => {
  if (key === 'team') return meta.team ? (meta.teamLink ? `[${meta.team}](${meta.teamLink})` : meta.team) : null;
  return meta[key] ? String(meta[key]) : null;
};
for (const f of ['README.md', 'docs/TECHNICAL_DOCUMENTATION.md']) {
  const src = fs.readFileSync(f, 'utf8');
  const out = src.replace(/<!-- meta:(\w+) -->([\s\S]*?)<!-- \/meta -->/g, (_, k, old) => `<!-- meta:${k} -->${metaValue(k) ?? old}<!-- /meta -->`);
  if (out !== src) fs.writeFileSync(f, out);
}

// ---- inline Markdown → runs ------------------------------------------------------------
const pngSize = (buf) => ({ w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) });
function image(file, maxWidthPx) {
  const data = fs.readFileSync(file);
  const { w, h } = pngSize(data);
  const width = Math.min(maxWidthPx, w);
  return new ImageRun({ type: 'png', data, transformation: { width, height: Math.round((h * width) / w) } });
}

function inline(text, base, opts = {}) {
  const runs = [];
  const size = opts.size;
  const re = /(!\[[^\]]*\]\([^)]+\))|(\[[^\]]+\]\([^)]+\))|(\*\*[^*]+\*\*)|(`[^`]+`)|(\*[^*\s][^*]*\*)|(<br\s*\/?>)/g;
  let last = 0;
  let m;
  const plain = (t, extra = {}) => t && runs.push(new TextRun({ text: t, size, ...extra }));
  while ((m = re.exec(text))) {
    plain(text.slice(last, m.index), opts.bold ? { bold: true } : {});
    const tok = m[0];
    if (m[1]) {
      const [, , src] = tok.match(/!\[([^\]]*)\]\(([^)]+)\)/);
      const file = path.resolve(base, src);
      if (fs.existsSync(file)) runs.push(image(file, opts.imageWidth ?? 600));
    } else if (m[2]) {
      const [, label, href] = tok.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (/^https?:/.test(href)) runs.push(new ExternalHyperlink({ link: href, children: [new TextRun({ text: label, style: 'Hyperlink', size })] }));
      else runs.push(new TextRun({ text: label, size, color: NAVY }));
    } else if (m[3]) runs.push(...inline(tok.slice(2, -2), base, { ...opts, bold: true }));
    else if (m[4]) runs.push(new TextRun({ text: tok.slice(1, -1), font: 'Consolas', size: size ? size - 1 : 18, color: '9A3412', bold: opts.bold }));
    else if (m[5]) runs.push(new TextRun({ text: tok.slice(1, -1), italics: true, size, bold: opts.bold }));
    else if (m[6]) runs.push(new TextRun({ text: '', break: 1, size }));
    last = m.index + tok.length;
  }
  plain(text.slice(last), opts.bold ? { bold: true } : {});
  return runs;
}

// ---- block Markdown → docx elements -----------------------------------------------------
let listInstance = 0;
const SPACER = () => Object.assign(new Paragraph({ spacing: { after: 120 }, children: [] }), { isSpacer: true });
function splitRow(line) {
  return line
    .trim()
    .replace(/^\||\|$/g, '')
    .split(/(?<!\\)\|/)
    .map((c) => c.trim().replace(/\\\|/g, '|'));
}

function table(lines, base, contentWidth) {
  const rows = lines.filter((l, i) => !(i === 1 && /^\|?\s*:?-{2,}/.test(l))).map(splitRow);
  const cols = Math.max(...rows.map((r) => r.length));
  const longest = Array.from({ length: cols }, (_, c) => Math.max(...rows.map((r) => (r[c] ?? '').replace(/!\[[^\]]*\]\([^)]+\)/g, 'x'.repeat(60)).replace(/<br>/g, ' ').replace(/\*\*|`/g, '').length))); // size by visible text, not Markdown markers
  // Short columns (#, HTTP, ms, PASS) get a fixed width that fits them, so they never wrap letter by letter;
  // the rest of the width is shared by the long columns in proportion to their content.
  const fixed = longest.map((len) => (len <= 9 ? (len + 1) * 115 + 200 : 0));
  const left = contentWidth - fixed.reduce((s, x) => s + x, 0);
  const weight = longest.map((len, c) => (fixed[c] ? 0 : Math.min(60, len)));
  const total = weight.reduce((s, x) => s + x, 0) || 1;
  const widths = longest.map((_, c) => fixed[c] || Math.floor((weight[c] / total) * left));
  widths[widths.length - 1] += contentWidth - widths.reduce((s, x) => s + x, 0);
  const small = cols >= 6 ? 15 : 17;
  return new Table({
    width: { size: contentWidth, type: WidthType.DXA },
    layout: TableLayoutType.FIXED, // long unbroken strings (JSON, paths) must wrap, not widen the table
    columnWidths: widths,
    rows: rows.map(
      (r, ri) =>
        new TableRow({
          tableHeader: ri === 0,
          cantSplit: true,
          children: Array.from({ length: cols }, (_, c) => {
            const txt = r[c] ?? '';
            const pass = txt === 'PASS';
            const fail = txt === 'FAIL';
            return new TableCell({
              width: { size: widths[c], type: WidthType.DXA },
              shading: ri === 0 ? { fill: 'E2E8F0', type: ShadingType.CLEAR, color: 'auto' } : pass ? { fill: 'ECFDF5', type: ShadingType.CLEAR, color: 'auto' } : fail ? { fill: 'FEF2F2', type: ShadingType.CLEAR, color: 'auto' } : undefined,
              margins: { top: 50, bottom: 50, left: 90, right: 90 },
              children: [new Paragraph({ spacing: { after: 0 }, children: inline(txt, base, { size: small, bold: ri === 0, imageWidth: Math.floor((widths[c] / 1440) * 96) - 12 }) })],
            });
          }),
        })
    ),
  });
}

function blocks(md, base, contentWidth) {
  const out = [];
  const lines = md.replace(/<!-- meta:\w+ -->|<!-- \/meta -->/g, '').replace(/<!--[\s\S]*?-->/g, '').split(/\r?\n/);
  let para = [];
  let listKind = null;
  const flush = () => {
    if (para.length) out.push(new Paragraph({ spacing: { after: 120, line: 276 }, children: inline(para.join(' '), base) }));
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      flush();
      const code = [];
      const indent = line.match(/^\s*/)[0].length; // fences indented inside a list item
      for (i++; i < lines.length && !/^\s*```/.test(lines[i]); i++) code.push(lines[i].slice(indent));
      code.forEach((c, k) =>
        out.push(
          new Paragraph({
            shading: { fill: 'F1F5F9', type: ShadingType.CLEAR, color: 'auto' },
            spacing: { after: k === code.length - 1 ? 160 : 0, line: 240 },
            indent: { left: 200, right: 200 },
            children: [new TextRun({ text: c || ' ', font: 'Consolas', size: 17, color: INK })],
          })
        )
      );
      continue;
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      flush();
      listKind = null;
      const level = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4][h[1].length - 1];
      out.push(new Paragraph({ heading: level, pageBreakBefore: h[1].length === 1 && out.length > 0, children: inline(h[2], base) }));
      continue;
    }
    if (/^\|/.test(line)) {
      flush();
      const t = [];
      for (; i < lines.length && /^\|/.test(lines[i]); i++) t.push(lines[i]);
      i--;
      out.push(table(t, base, contentWidth));
      out.push(SPACER());
      continue;
    }
    const img = line.match(/^!\[([^\]]*)\]\(([^)]+)\)\s*$/);
    if (img) {
      flush();
      const file = path.resolve(base, img[2]);
      if (fs.existsSync(file)) {
        out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60 }, children: [image(file, Math.floor((contentWidth / 1440) * 96))] }));
        out.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: `Figure: ${img[1]}`, italics: true, size: 18, color: MUTED })] }));
      }
      continue;
    }
    const li = line.match(/^(\s*)([-*]|\d+\.)\s+(.*)$/);
    if (li) {
      flush();
      const ordered = /\d/.test(li[2]);
      const level = Math.min(1, Math.floor(li[1].length / 2));
      if (listKind !== (ordered ? 'o' : 'u') && level === 0) listInstance++;
      listKind = ordered ? 'o' : 'u';
      let text = li[3];
      while (i + 1 < lines.length && /^\s{2,}\S/.test(lines[i + 1]) && !/^\s*([-*]|\d+\.)\s|^\s*```/.test(lines[i + 1])) text += ' ' + lines[++i].trim();
      out.push(new Paragraph({ numbering: ordered ? { reference: 'numbers', level, instance: listInstance } : { reference: 'bullets', level }, spacing: { after: 60, line: 264 }, children: inline(text, base) }));
      continue;
    }
    if (!line.trim()) {
      flush();
      // An indented code fence belongs to the list item, so numbering continues after it.
      if (listKind && !/^\s*([-*]|\d+\.)\s|^\s+```/.test(lines[i + 1] ?? '')) listKind = null;
      continue;
    }
    if (/^---+$/.test(line.trim())) {
      flush();
      out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'CBD5E1', space: 1 } }, children: [] }));
      continue;
    }
    para.push(line.trim());
  }
  flush();
  if (out.at(-1)?.isSpacer) out.pop(); // a spacer after the last table would start an empty page
  return out;
}

// ---- documents --------------------------------------------------------------------------
function cover(no, title, subtitle) {
  const line = (label, value) =>
    new Paragraph({
      spacing: { after: 80 },
      children: [new TextRun({ text: `${label}  `, bold: true, color: MUTED, size: 22 }), ...(/^https?:/.test(value) ? [new ExternalHyperlink({ link: value, children: [new TextRun({ text: value, style: 'Hyperlink', size: 22 })] })] : [new TextRun({ text: value, size: 22, color: INK })])],
    });
  return [
    new Paragraph({ spacing: { before: 1800, after: 120 }, children: [new TextRun({ text: 'Shenzhen International FinTech Competition 2026', size: 24, color: MUTED })] }),
    new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: `DELIVERABLE ${no}`, bold: true, size: 26, color: '7C3AED' })] }),
    new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: 'WealthPilot', bold: true, size: 72, color: INK })] }),
    new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: title, bold: true, size: 40, color: NAVY })] }),
    new Paragraph({ spacing: { after: 900 }, border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: NAVY, space: 8 } }, children: [new TextRun({ text: subtitle, size: 24, color: MUTED })] }),
    line('Team', meta.team || 'WealthPilot Team'),
    ...(meta.members ?? []).map(
      (m) =>
        new Paragraph({
          spacing: { after: 40 },
          indent: { left: 360 },
          children: [new TextRun({ text: m.name, bold: true, size: 21, color: INK }), ...(m.role ? [new TextRun({ text: `  ·  ${m.role}`, size: 19, color: MUTED })] : [])],
        })
    ),
    ...(meta.institution ? [new Paragraph({ spacing: { after: 120 }, indent: { left: 360 }, children: [new TextRun({ text: meta.institution, italics: true, size: 19, color: MUTED })] })] : []),
    line('Live application', meta.liveUrl || 'to be added'),
    line('Source code', meta.github),
    line('Version', `${meta.version} · ${meta.date}`),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function buildDoc({ no, title, subtitle, sources, landscape, file, tocLevels = 3 }) {
  const pageW = landscape ? 16838 : 11906;
  const margin = 1080;
  const contentWidth = pageW - 2 * margin;
  listInstance = 0;
  const body = sources.flatMap((s) => blocks(fs.readFileSync(s, 'utf8'), path.dirname(path.resolve(s)), contentWidth));
  const doc = new Document({
    creator: meta.team || 'WealthPilot Team',
    title: `WealthPilot · ${title}`,
    description: subtitle,
    features: { updateFields: true },
    styles: {
      default: { document: { run: { font: 'Calibri', size: 21, color: INK } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 34, bold: true, color: NAVY }, paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 0 } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 28, bold: true, color: NAVY }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 24, bold: true, color: INK }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } },
        { id: 'Heading4', name: 'Heading 4', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { size: 22, bold: true, color: INK }, paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 3 } },
      ],
    },
    numbering: {
      config: [
        { reference: 'bullets', levels: [0, 1].map((level) => ({ level, format: LevelFormat.BULLET, text: level ? '–' : '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 400 + level * 360, hanging: 260 } } } })) },
        { reference: 'numbers', levels: [0, 1].map((level) => ({ level, format: level ? LevelFormat.LOWER_LETTER : LevelFormat.DECIMAL, text: level ? '%2)' : '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 400 + level * 360, hanging: 300 } } } })) },
      ],
    },
    sections: [
      {
        properties: { titlePage: true, page: { size: { width: 11906, height: 16838, orientation: landscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT }, margin: { top: 1080, bottom: 1080, left: margin, right: margin } } },
        headers: { default: new Header({ children: [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1', space: 4 } }, children: [new TextRun({ text: `WealthPilot · Deliverable ${no}: ${title}`, size: 16, color: MUTED })] })] }) },
        footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ size: 16, color: MUTED, children: ['Page ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES] })] })] }) },
        children: [
          ...cover(no, title, subtitle),
          new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: 'Contents', bold: true, size: 34, color: NAVY })] }),
          new TableOfContents('Contents', { hyperlink: true, headingStyleRange: `1-${tocLevels}` }),
          new Paragraph({ spacing: { before: 120 }, children: [new TextRun({ text: 'If the contents list is empty, right-click it and choose Update Field.', italics: true, size: 16, color: MUTED })] }),
          new Paragraph({ children: [new PageBreak()] }),
          ...body,
        ],
      },
    ],
  });
  return Packer.toBuffer(doc).then((buf) => {
    try {
      fs.writeFileSync(file, buf);
      console.log(`${file}  ${(buf.length / 1024).toFixed(0)} KB`);
    } catch (e) {
      if (e.code !== 'EBUSY' && e.code !== 'EPERM') throw e;
      console.warn(`SKIPPED ${file}: it is open in another program (Word?). Close it and run npm run docs:build again.`);
      process.exitCode = 1;
    }
  });
}

await buildDoc({ no: '01', title: 'Technical Documentation', subtitle: 'System architecture · Core algorithms · Security design', sources: ['docs/TECHNICAL_DOCUMENTATION.md'], file: 'submission/01_Technical_Documentation.docx' });
await buildDoc({ no: '04', title: 'Source Code: README, Deployment and Test Cases', subtitle: 'Repository guide · Deployment instructions · Test catalogue with results', sources: ['README.md', 'docs/DEPLOYMENT.md', 'docs/TEST_CASES.md'], file: 'submission/04_Source_Code_README_Deployment_Tests.docx', tocLevels: 2 });
await buildDoc({ no: '04A', title: 'Test Report', subtitle: 'Strategy · Results · Traceability · Defect analysis', sources: ['docs/TEST_REPORT.md', 'docs/TEST_CASES.md'], file: 'submission/04A_Test_Report.docx', tocLevels: 2 });
await buildDoc({ no: '05', title: 'Security Self-Assessment Report', subtitle: 'Permission-tier implementation · Control assessment · Known-risk list', sources: ['docs/SECURITY_SELF_ASSESSMENT.md', 'docs/ROUTE_INVENTORY.md'], landscape: true, file: 'submission/05_Security_Self_Assessment_Report.docx', tocLevels: 2 });
await buildDoc({ no: '06', title: 'Simulated-Account / Sandbox Operation Logs', subtitle: 'Execution evidence for a non-on-chain topic', sources: ['docs/SANDBOX_OPERATION_LOG.md'], landscape: true, file: 'submission/06_Sandbox_Operation_Logs.docx' });
