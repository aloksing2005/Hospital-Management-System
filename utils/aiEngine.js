const symptomMap = {
  fever: "General Physician",
  cough: "General Physician",
  cold: "ENT",
  chest: "Cardiologist",
  heart: "Cardiologist",
  skin: "Dermatologist",
  rash: "Dermatologist",
  eye: "Ophthalmologist",
  tooth: "Dentist",
  headache: "Neurologist",
  bone: "Orthopedic",
  stomach: "Gastroenterologist",
  back: "Orthopedic",
  knee: "Orthopedic",
  ear: "ENT",
  throat: "ENT",
  diabetes: "Endocrinologist",
  thyroid: "Endocrinologist",
  child: "Pediatrician",
  baby: "Pediatrician",
  pregnancy: "Gynecologist",
  women: "Gynecologist"
};

const medicineMap = {
  fever: ["Paracetamol 500mg", "Rest", "Hydration", "Light meals"],
  cold: ["Cetirizine 10mg", "Steam inhalation", "Warm fluids", "Vitamin C"],
  cough: ["Dextromethorphan syrup", "Steam inhalation", "Honey with warm water"],
  headache: ["Paracetamol 500mg", "Rest in dark room", "Hydration"],
  stomach: ["ORS solution", "Light diet", "Pantoprazole 40mg"],
  skin: ["Cetirizine 10mg", "Calamine lotion", "Avoid scratching"],
  eye: ["Artificial tears", "Rest eyes", "Avoid screens"],
  tooth: ["Ibuprofen 400mg", "Salt water gargle", "Dental consultation"],
  chest: ["Aspirin 75mg", "Rest", "Immediate cardiologist consultation"],
  bone: ["Calcium supplement", "Vitamin D3", "Rest affected area"]
};

function findSpecialization(text = "") {
  const lower = text.toLowerCase();
  const key = Object.keys(symptomMap).find(k => lower.includes(k));
  return key ? symptomMap[key] : null;
}

function suggestMedicines(text = "") {
  const lower = text.toLowerCase();
  const key = Object.keys(medicineMap).find(k => lower.includes(k));
  return key ? medicineMap[key] : ["Consult doctor for proper diagnosis"];
}

function generateSlots(fromTime, toTime, interval = 30) {
  const slots = [];
  const [fh, fm] = fromTime.split(":").map(Number);
  const [th, tm] = toTime.split(":").map(Number);

  let start = fh * 60 + fm;
  const end = th * 60 + tm;

  while (start + interval <= end) {
    const sh = String(Math.floor(start / 60)).padStart(2, "0");
    const sm = String(start % 60).padStart(2, "0");
    const eh = String(Math.floor((start + interval) / 60)).padStart(2, "0");
    const em = String((start + interval) % 60).padStart(2, "0");
    slots.push(`${sh}:${sm} - ${eh}:${em}`);
    start += interval;
  }

  return slots;
}

module.exports = { findSpecialization, suggestMedicines, generateSlots };
