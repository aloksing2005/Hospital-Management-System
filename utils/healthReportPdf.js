const PDFDocument = require("pdfkit");
const fs = require("fs");

/**
 * Generate a consolidated patient health summary PDF (appointments + prescriptions snapshot).
 */
function writeHealthReportPdf({ patientName, patientEmail, appointments, prescriptions }, outPath) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = fs.createWriteStream(outPath);
    doc.pipe(stream);

    doc.fontSize(20).text("Patient Health Summary", { underline: true });
    doc.moveDown();
    doc.fontSize(11).text(`Patient: ${patientName}`);
    doc.text(`Email: ${patientEmail || "—"}`);
    doc.text(`Generated: ${new Date().toLocaleString()}`);
    doc.moveDown();

    doc.fontSize(14).text("Recent appointments", { underline: true });
    doc.moveDown(0.5);
    if (!appointments || appointments.length === 0) {
      doc.fontSize(10).text("No appointment records.");
    } else {
      appointments.slice(0, 15).forEach((a) => {
        const d = a.date ? (a.date instanceof Date ? a.date.toISOString().slice(0, 10) : String(a.date).slice(0, 10)) : "—";
        doc
          .fontSize(10)
          .text(
            `• ${d} ${a.time_slot || ""} — Dr. ${a.doctor_name || "?"} — ${a.status}${a.symptoms ? ` — ${String(a.symptoms).slice(0, 80)}` : ""}`
          );
      });
    }
    doc.moveDown();

    doc.fontSize(14).text("Prescriptions on file", { underline: true });
    doc.moveDown(0.5);
    if (!prescriptions || prescriptions.length === 0) {
      doc.fontSize(10).text("No prescriptions.");
    } else {
      prescriptions.slice(0, 15).forEach((p) => {
        const t = p.created_at ? (p.created_at instanceof Date ? p.created_at.toISOString().slice(0, 10) : String(p.created_at).slice(0, 10)) : "—";
        doc
          .fontSize(10)
          .text(`• ${t} — Dr. ${p.doctor_name} — ${p.disease || "—"} — ${String(p.medicines || "").slice(0, 120)}`);
      });
    }

    doc.end();
    stream.on("finish", () => resolve(outPath));
    stream.on("error", reject);
  });
}

module.exports = { writeHealthReportPdf };
