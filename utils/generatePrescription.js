const PDFDocument = require("pdfkit");
const fs = require("fs");
const QRCode = require("qrcode");

async function generatePrescription(data, filePath) {
  return new Promise(async (resolve, reject) => {
    const doc = new PDFDocument();
    const stream = fs.createWriteStream(filePath);

    stream.on("error", reject);
    doc.pipe(stream);

    // Header
    doc.fontSize(24).fillColor("#1a5276").text("CITY HOSPITAL", 50, 50);
    doc.fontSize(12).fillColor("#666").text("Digital Prescription System", 50, 80);
    doc.moveDown();

    // Doctor Section
    doc.fontSize(14).fillColor("#333").text("PRESCRIPTION", 50, 110, { underline: true });

    if (data.photo && fs.existsSync(data.photo.replace("/images/", "public/images/"))) {
      try {
        doc.image(data.photo.replace("/images/", "public/images/"), 400, 50, { width: 100 });
      } catch (e) {}
    }

    doc.fontSize(12).fillColor("#333");
    doc.text(`Dr. ${data.doctorName || "Doctor"}`, 50, 140);
    doc.fontSize(10).fillColor("#666").text(data.address || "Hospital Address");
    doc.text(`Date: ${data.date || new Date().toLocaleDateString()}`);
    doc.moveDown();

    // Separator
    doc.strokeColor("#1a5276").lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    // Patient Details
    doc.fontSize(12).fillColor("#333").text(`Patient Name: ${data.patientName || "N/A"}`);
    doc.text(`Disease/Condition: ${data.disease || "N/A"}`);
    doc.moveDown();

    // Medicines
    doc.fontSize(14).fillColor("#1a5276").text("Prescribed Medicines:", { underline: true });
    doc.moveDown(0.5);

    doc.fontSize(11).fillColor("#333");
    if (data.medicines && data.medicines.length > 0) {
      data.medicines.forEach((med, index) => {
        doc.text(`${index + 1}. ${med}`, { indent: 20 });
      });
    } else {
      doc.text("No medicines prescribed", { indent: 20 });
    }

    doc.moveDown();

    // Footer
    doc.strokeColor("#1a5276").lineWidth(1).moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();
    doc.fontSize(10).fillColor("#666").text("This is a computer-generated prescription.");
    doc.text("Please consult your doctor before taking any medication.");
    // QR Code
    try {
      const qrText = `Verified Prescription\nDr: ${data.doctorName}\nPatient: ${data.patientName}\nDate: ${data.date || new Date().toLocaleDateString()}`;
      const qrImage = await QRCode.toDataURL(qrText);
      doc.image(qrImage, 400, doc.y - 40, { width: 80 });
    } catch (err) {
      console.error("QR Code generation error:", err);
    }

    doc.end();
    stream.on("finish", resolve);
  });
}


