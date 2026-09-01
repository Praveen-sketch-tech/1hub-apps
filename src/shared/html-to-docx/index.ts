import JSZip from "jszip";

type DocxOptions = {
  title?: string;
  author?: string;
};

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escAttr(value: string): string {
  return esc(value);
}

function pxToTwips(px: number): number {
  return Math.max(1, Math.round(px * 15));
}

function runXml(
  text: string,
  style: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strike?: boolean;
    size?: number;
  } = {}
): string {
  const props: string[] = [];

  if (style.bold) props.push("<w:b/>");
  if (style.italic) props.push("<w:i/>");
  if (style.underline) props.push('<w:u w:val="single"/>');
  if (style.strike) props.push("<w:strike/>");
  if (style.size) props.push(`<w:sz w:val="${style.size}"/>`);

  const rPr = props.length ? `<w:rPr>${props.join("")}</w:rPr>` : "";

  const parts = text.split("\n");

  return parts
    .map((part, index) => {
      const preserve = /^\s|\s$/.test(part) ? ' xml:space="preserve"' : "";
      const r = `<w:r>${rPr}<w:t${preserve}>${esc(part)}</w:t></w:r>`;
      return index === 0 ? r : `<w:r><w:br/></w:r>${r}`;
    })
    .join("");
}

function getStyle(el: HTMLElement) {
  const cs = getComputedStyle(el);

  const weight = parseInt(cs.fontWeight || "400", 10);

  return {
    bold: weight >= 600,
    italic: cs.fontStyle === "italic",
    underline: cs.textDecorationLine.includes("underline"),
    strike: cs.textDecorationLine.includes("line-through"),
    size: Math.max(8, Math.round(parseFloat(cs.fontSize || "14") * 2)),
    align:
      cs.textAlign === "center"
        ? "center"
        : cs.textAlign === "right" || cs.textAlign === "end"
          ? "right"
          : cs.textAlign === "justify"
            ? "both"
            : "left",
  };
}

function inlineRuns(node: Node, inherited: ReturnType<typeof getStyle>): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return runXml(node.nodeValue || "", inherited);
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const el = node as HTMLElement;
  const cs = getComputedStyle(el);

  const style = {
    bold: inherited.bold || cs.fontWeight === "bold" || parseInt(cs.fontWeight, 10) >= 600,
    italic: inherited.italic || cs.fontStyle === "italic",
    underline: inherited.underline || cs.textDecorationLine.includes("underline"),
    strike: inherited.strike || cs.textDecorationLine.includes("line-through"),
    size: Math.max(
      8,
      Math.round(parseFloat(cs.fontSize || `${inherited.size / 2}`) * 2)
    ),
    align: inherited.align,
  };

  return Array.from(el.childNodes)
    .map((child) => inlineRuns(child, style))
    .join("");
}

function paragraphXml(el: HTMLElement): string {
  const style = getStyle(el);

  const pPr = `<w:pPr><w:jc w:val="${style.align}"/></w:pPr>`;

  const content = Array.from(el.childNodes)
    .map((node) => inlineRuns(node, style))
    .join("");

  return `<w:p>${pPr}${content}</w:p>`;
}

function cellWidth(cell: HTMLElement, table: HTMLElement): number {
  const width =
    cell.getBoundingClientRect().width ||
    parseFloat(getComputedStyle(cell).width || "0");

  const tableWidth =
    table.getBoundingClientRect().width ||
    parseFloat(getComputedStyle(table).width || "800");

  if (!width || !tableWidth) return 2400;

  return Math.max(200, Math.round((width / tableWidth) * 9000));
}

function tableXml(table: HTMLTableElement): string {
  const rows = Array.from(table.rows);

  if (!rows.length) return "";

  const gridWidths: number[] = [];

  const firstRow = rows[0];

  Array.from(firstRow.cells).forEach((cell) => {
    gridWidths.push(cellWidth(cell as HTMLElement, table));
  });

  const grid = gridWidths
    .map((width) => `<w:gridCol w:w="${width}"/>`)
    .join("");

  const body = rows
    .map((row) => {
      const cells = Array.from(row.cells)
        .map((cell) => {
          const htmlCell = cell as HTMLElement;
          const width = cellWidth(htmlCell, table);

          const cellContent = Array.from(htmlCell.children)
            .map((child) => {
              const childEl = child as HTMLElement;

              if (/^P$/i.test(childEl.tagName)) {
                return paragraphXml(childEl);
              }

              return paragraphXml(childEl);
            })
            .join("");

          const fallback =
            cellContent ||
            paragraphXml(
              Object.assign(document.createElement("p"), {
                innerHTML: htmlCell.innerHTML,
              })
            );

          const cs = getComputedStyle(htmlCell);

          const borders = `
            <w:tcBorders>
              <w:top w:val="single" w:sz="4" w:color="000000"/>
              <w:left w:val="single" w:sz="4" w:color="000000"/>
              <w:bottom w:val="single" w:sz="4" w:color="000000"/>
              <w:right w:val="single" w:sz="4" w:color="000000"/>
            </w:tcBorders>`;

          const padding = Math.max(
            40,
            Math.round(parseFloat(cs.paddingLeft || "6") * 15)
          );

          return `
            <w:tc>
              <w:tcPr>
                <w:tcW w:w="${width}" w:type="dxa"/>
                ${borders}
                <w:tcMar>
                  <w:top w:w="${padding}" w:type="dxa"/>
                  <w:left w:w="${padding}" w:type="dxa"/>
                  <w:bottom w:w="${padding}" w:type="dxa"/>
                  <w:right w:w="${padding}" w:type="dxa"/>
                </w:tcMar>
              </w:tcPr>
              ${fallback}
            </w:tc>`;
        })
        .join("");

      return `<w:tr>${cells}</w:tr>`;
    })
    .join("");

  return `
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="9000" w:type="dxa"/>
        <w:tblLayout w:type="fixed"/>
      </w:tblPr>
      <w:tblGrid>${grid}</w:tblGrid>
      ${body}
    </w:tbl>`;
}

function bodyXml(root: HTMLElement): string {
  return Array.from(root.children)
    .map((child) => {
      const el = child as HTMLElement;

      if (el.tagName.toLowerCase() === "table") {
        return tableXml(el as HTMLTableElement);
      }

      if (
        ["p", "div", "section", "article", "header", "footer", "h1", "h2", "h3", "h4"].includes(
          el.tagName.toLowerCase()
        )
      ) {
        return paragraphXml(el);
      }

      return paragraphXml(el);
    })
    .join("");
}

function contentTypesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
</Types>`;
}

function relationshipsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;
}

function documentRelationshipsXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>`;
}

function stylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults>
<w:rPrDefault>
<w:rPr>
<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/>
<w:sz w:val="28"/>
</w:rPr>
</w:rPrDefault>
<w:pPrDefault>
<w:pPr>
<w:spacing w:after="120" w:line="360" w:lineRule="auto"/>
</w:pPr>
</w:pPrDefault>
</w:docDefaults>
</w:styles>`;
}

function documentXml(content: string) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${content}
<w:sectPr>
<w:pgSz w:w="11906" w:h="16838"/>
<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/>
</w:sectPr>
</w:body>
</w:document>`;
}

function coreXml(options: DocxOptions) {
  const title = esc(options.title || "Document");
  const author = esc(options.author || "1 Hub Apps");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
xmlns:dc="http://purl.org/dc/elements/1.1/"
xmlns:dcterms="http://purl.org/dc/terms/"
xmlns:dcmitype="http://purl.org/dc/dcmitype/"
xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>${title}</dc:title>
<dc:creator>${author}</dc:creator>
</cp:coreProperties>`;
}

function appXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties">
<Application>1 Hub Apps</Application>
</Properties>`;
}

export async function htmlToDocx(
  htmlOrElement: string | HTMLElement,
  options: DocxOptions = {}
): Promise<Blob> {
  const root = document.createElement("div");

  if (typeof htmlOrElement === "string") {
    root.innerHTML = htmlOrElement;
  } else {
    root.innerHTML = htmlOrElement.innerHTML;
  }

  const content = bodyXml(root);

  const zip = new JSZip();

  zip.file("[Content_Types].xml", contentTypesXml());

  zip.folder("_rels")!.file(".rels", relationshipsXml());

  zip.folder("word")!.file("document.xml", documentXml(content));
  zip.folder("word")!.file("styles.xml", stylesXml());
  zip.folder("word/_rels")!.file("document.xml.rels", documentRelationshipsXml());

  zip.folder("docProps")!.file("core.xml", coreXml(options));
  zip.folder("docProps")!.file("app.xml", appXml());

  return zip.generateAsync({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

export default htmlToDocx;
