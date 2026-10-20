import { writeFileSync, mkdirSync } from "node:fs";
import { zipSync, strToU8 } from "fflate";

const escapeXml = (value) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;").replace(/'/g, "&apos;");
const columnName = (index) => {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
};
const sheetXml = (sheet) => {
  const rows = sheet.rows.map((row, rowIndex) => {
    const cells = row.map((value, colIndex) => value === "" ? "" : `<c r="${columnName(colIndex)}${rowIndex + 1}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  const merges = sheet.merges?.length ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((ref) => `<mergeCell ref="${ref}"/>`).join("")}</mergeCells>` : "";
  return `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheetData>${rows}</sheetData>${merges}</worksheet>`;
};
const workbook = (sheets) => {
  const workbookSheets = sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("");
  const relationships = sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join("");
  const files = {
    "[Content_Types].xml": strToU8(`<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>`),
    "xl/workbook.xml": strToU8(`<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${workbookSheets}</sheets></workbook>`),
    "xl/_rels/workbook.xml.rels": strToU8(`<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relationships}</Relationships>`),
  };
  sheets.forEach((sheet, index) => { files[`xl/worksheets/sheet${index + 1}.xml`] = strToU8(sheetXml(sheet)); });
  return zipSync(files);
};

const headers = ["Lớp", "Mã HP", "Môn", "TC", "Mã LHP", "Nhóm", "Loại buổi", "Thứ", "Ca", "Tiết", "GĐ", "GV", "Ghi chú", "Unknown", "X", "Y", "Z"];
const hk1 = workbook([{
  name: "HK1-row1",
  rows: [headers, ["K69I", "UET.INT2213", "Lập trình", "3", "INT2213 1", "CL", "LT", "T7", " 2 ", "", "203-G2", "GV A+GV B", "Học tuần 1-5. Học tiết 9-12", "synthetic"]],
}]);
const hk2Headers = ["Lớp khóa", "Mã môn", "Tên học phần", "Tín chỉ", "Mã lớp học phần", "Nhóm", "LT+BT/TH", "Thu", "Ca học", "Tiết học", "Phòng học", "Giảng viên", "Tuần học", "PCGD", "Cột 15", "Cột 16", "Cột 17", "Cột 18"];
const hk2 = workbook([{
  name: "HK2-row4",
  rows: [["UET timetable", ""], ["official synthetic", ""], ["", ""], hk2Headers, ["K70", "MAT1051", "Toán", "3", "MAT1051 2", "1", "LT", "T2", "1", "", "Hòa Lạc A", "GV C", "Học tuần 6-15", "PCGD-1"], ["", "MAT1051", "Toán", "3", "", "1", "LT", "T2", "1", "", "Hòa Lạc A", "GV C", "", "", ""]],
  merges: ["A5:A6", "E5:E6", "M5:M6"],
}]);

mkdirSync("fixtures/synthetic-uet-xlsx", { recursive: true });
writeFileSync("fixtures/synthetic-uet-xlsx/hk1-row1.xlsx", hk1);
writeFileSync("fixtures/synthetic-uet-xlsx/hk2-row4.xlsx", hk2);
