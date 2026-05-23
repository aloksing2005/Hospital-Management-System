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
  women: "Gynecologist",
  malaria: "General Physician",
  dengue: "General Physician"
};

const medicineMap = {
  fever: ["Paracetamol 500mg", "Rest", "Hydration", "Light meals"],
  cold: ["Cetirizine 10mg", "Steam inhalation", "Warm fluids", "Vitamin C"],
  cough: ["Dextromethorphan syrup", "Steam inhalation", "Honey with warm water"],
  headache: ["Paracetamol 500mg", "Rest in dark room", "Hydration"],
  stomach: ["ORS solution", "Light diet", "Pantoprazole 40mg", "Dicyclomine (for colic pain)"],
  skin: ["Cetirizine 10mg", "Calamine lotion", "Avoid scratching"],
  eye: ["Artificial tears", "Rest eyes", "Avoid screens"],
  tooth: ["Ibuprofen 400mg", "Salt water gargle", "Dental consultation"],
  chest: ["Aspirin 75mg", "Rest", "Immediate cardiologist consultation"],
  bone: ["Calcium supplement", "Vitamin D3", "Rest affected area", "Pain relief gel"],
  malaria: ["Chloroquine", "Paracetamol (for fever)", "Hydration therapy"],
  dengue: ["Hydration (ORS/Coconut water)", "Paracetamol (strictly avoid Ibuprofen/Aspirin)", "Platelet count monitor"]
};

function normalizeHinglish(text = "") {
  let lower = text.toLowerCase();
  const dictionary = {
    // Fever / Typhoid / Dengue
    "bukhar": "fever",
    "bukhaar": "fever",
    "bughar": "fever",
    "tapman": "fever",
    "garm": "fever",
    "body heat": "fever",
    "dengu": "dengue",
    "dengue": "dengue",
    "malariya": "malaria",
    "malaria": "malaria",
    
    // Cough
    "khansi": "cough",
    "khasi": "cough",
    "khaansee": "cough",
    "cough": "cough",
    "caugh": "cough",
    
    // Cold / Nasal
    "jukham": "cold",
    "jukhaam": "cold",
    "zukan": "cold",
    "zukham": "cold",
    "sardi": "cold",
    "flu": "cold",
    
    // Headache / Migraine
    "sir dard": "headache",
    "sir dukh": "headache",
    "sirme dard": "headache",
    "sardard": "headache",
    "headache": "headache",
    "head pain": "headache",
    "head ache": "headache",
    
    // Stomach / Digestive
    "pet dard": "stomach",
    "pet kharab": "stomach",
    "pet me dard": "stomach",
    "stomach pain": "stomach",
    "vomit": "stomach",
    "vomiting": "stomach",
    "ultee": "stomach",
    "ulti": "stomach",
    "gas": "stomach",
    "acidity": "stomach",
    "dast": "stomach",
    "loose motion": "stomach",
    
    // Chest / Cardiac
    "chhati dard": "chest",
    "chhati me dard": "chest",
    "chest pain": "chest",
    "dil": "heart",
    "dil me dard": "heart",
    "heart pain": "heart",
    
    // Skin / Allergy
    "khujli": "skin",
    "allergy": "skin",
    "rash": "skin",
    "skin": "skin",
    
    // Eyes
    "aankh": "eye",
    "aankhe": "eye",
    "eyes": "eye",
    
    // Dental
    "daant": "tooth",
    "dant": "tooth",
    "teeth": "tooth",
    "tooth": "tooth",
    
    // Bones / Orthopedic
    "haddi": "bone",
    "joint pain": "bone",
    "joint": "bone",
    "bone": "bone",
    "knee": "bone",
    "kamar": "bone",
    "back": "bone",
    
    // Throat / Ear
    "gala": "throat",
    "gale": "throat",
    "throat": "throat",
    "kaan": "ear",
    "ear": "ear",
    
    // Pediatrics / Pregnancy
    "bacha": "baby",
    "bacche": "baby",
    "baby": "baby",
    "child": "baby",
    "garbh": "pregnancy",
    "pregnancy": "pregnancy",
    "period": "pregnancy"
  };
  
  for (const [hinglish, english] of Object.entries(dictionary)) {
    if (lower.includes(hinglish)) {
      lower += " " + english;
    }
  }
  return lower;
}

function findSpecialization(text = "") {
  const lower = normalizeHinglish(text);
  
  // Prioritize high-severity cardiovascular queries first
  const highPriority = ["chest", "heart"];
  for (const k of highPriority) {
    if (lower.includes(k)) return symptomMap[k];
  }
  
  const key = Object.keys(symptomMap).find(k => lower.includes(k));
  return key ? symptomMap[key] : "General Physician";
}

function suggestMedicines(text = "") {
  const lower = normalizeHinglish(text);
  const matchedMeds = [];
  
  for (const [key, meds] of Object.entries(medicineMap)) {
    if (lower.includes(key)) {
      matchedMeds.push(...meds);
    }
  }
  
  // De-duplicate and return clean suggestion list
  if (matchedMeds.length > 0) {
    return [...new Set(matchedMeds)].slice(0, 6);
  }
  
  return ["Consult doctor for proper diagnosis", "Rest and hydration"];
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

