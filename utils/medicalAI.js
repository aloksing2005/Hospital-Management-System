const { findSpecialization, suggestMedicines } = require("./aiEngine");
const doctorModel = require("../models/doctorModel");

const conditionDb = {
  fever: {
    name: "Viral Fever",
    description: "A temporary rise in body temperature often caused by viral infections. Rest and hydration help recovery.",
    severity: "moderate"
  },
  cough: {
    name: "Acute Cough",
    description: "Inflammation of airways causing persistent cough. May be viral or allergic in origin.",
    severity: "low"
  },
  cold: {
    name: "Common Cold",
    description: "Upper respiratory infection with runny nose, sneezing, and mild fatigue.",
    severity: "low"
  },
  headache: {
    name: "Tension Headache",
    description: "Pressure-like head pain often linked to stress, dehydration, or eye strain.",
    severity: "low"
  },
  chest: {
    name: "Chest Discomfort",
    description: "May indicate cardiac or respiratory issues. Seek urgent care if pain is severe or radiating.",
    severity: "high"
  },
  heart: {
    name: "Cardiac Concern",
    description: "Symptoms affecting the heart require prompt medical evaluation.",
    severity: "high"
  },
  stomach: {
    name: "Gastric Distress",
    description: "Digestive upset including nausea, bloating, vomiting, or abdominal pain.",
    severity: "moderate"
  },
  skin: {
    name: "Dermatitis",
    description: "Skin irritation or rash that may be allergic or infectious.",
    severity: "low"
  },
  diabetes: {
    name: "Blood Sugar Imbalance",
    description: "Glucose regulation issues requiring specialist monitoring.",
    severity: "moderate"
  },
  pregnancy: {
    name: "Prenatal Care Needed",
    description: "Pregnancy-related symptoms should be evaluated by a gynecologist.",
    severity: "moderate"
  },
  malaria: {
    name: "Malaria Infection",
    description: "Mosquito-borne infectious disease causing high fever, chills, and flu-like symptoms.",
    severity: "high"
  },
  dengue: {
    name: "Dengue Fever",
    description: "Viral infection transmitted by mosquitoes, causing severe body pain, fever, and drop in platelets.",
    severity: "high"
  }
};

const precautionMap = {
  fever: ["Drink plenty of fluids", "Rest for 24–48 hours", "Monitor temperature every 4 hours", "Avoid strenuous activity"],
  cough: ["Avoid cold drinks", "Use steam inhalation", "Stay away from smoke", "Cover mouth when coughing"],
  cold: ["Wash hands frequently", "Get adequate sleep", "Eat warm soups", "Avoid crowded places"],
  chest: ["Seek immediate medical attention if pain worsens", "Avoid heavy exertion", "Sit upright if breathless"],
  stomach: ["Eat light, bland foods", "Avoid spicy and oily food", "Stay hydrated with ORS"],
  malaria: ["Take complete bed rest", "Use insect repellents/nets", "Stay well-hydrated"],
  dengue: ["Hydrate intensively (ORS/coconut water)", "Monitor platelet counts closely", "Avoid self-medicating with Aspirin/Ibuprofen"],
  default: ["Follow prescribed medicines", "Maintain a balanced diet", "Contact your doctor if symptoms worsen"]
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

function detectConditions(text = "") {
  const lower = normalizeHinglish(text);
  const found = [];
  for (const key of Object.keys(conditionDb)) {
    if (lower.includes(key)) found.push({ key, ...conditionDb[key] });
  }
  if (found.length === 0) {
    found.push({
      key: "general",
      name: "General Health Concern",
      description: "Your symptoms need a clinical evaluation for an accurate diagnosis.",
      severity: "low"
    });
  }
  return found.slice(0, 3);
}

function getPrecautions(text = "") {
  const lower = normalizeHinglish(text);
  for (const key of Object.keys(precautionMap)) {
    if (key !== "default" && lower.includes(key)) return precautionMap[key];
  }
  return precautionMap.default;
}

async function analyzeSymptoms(symptomsText = "") {
  const text = String(symptomsText).trim();
  const specialty = findSpecialization(text) || "General Physician";
  const medicines = suggestMedicines(text);
  const conditions = detectConditions(text);
  const precautions = getPrecautions(text);

  let recommendedDoctors = [];
  try {
    // 3-Stage Doctor Match Fallback
    // Stage 1: Case-insensitive search using the specialty
    let doctors = await doctorModel.searchDoctorsAdvanced({
      specialization: specialty,
      sort: "rating"
    });
    
    // Stage 2: Broad keyword search using the specialty
    if (!doctors || doctors.length === 0) {
      doctors = await doctorModel.searchDoctorsAdvanced({
        search: specialty,
        sort: "rating"
      });
    }
    
    // Stage 3: Fetch any active doctors from the hospital inventory to avoid empty widgets
    if (!doctors || doctors.length === 0) {
      doctors = await doctorModel.getAllDoctors();
    }
    
    recommendedDoctors = (doctors || []).slice(0, 3).map(d => ({
      doctor_id: d._id || d.id,
      name: d.name,
      specialization: d.specialization || "General Physician",
      fees: d.fees
    }));
  } catch (e) {
    recommendedDoctors = [];
  }

  const summary = [
    `Based on your reported symptoms, possible conditions include: ${conditions.map(c => c.name).join(", ")}.`,
    `Recommended specialist: ${specialty}.`,
    `Suggested care: ${medicines.slice(0, 3).join(", ")}.`,
    "This is an AI-assisted guide — please consult a licensed doctor for diagnosis."
  ].join(" ");

  return {
    symptoms: text,
    possible_conditions: conditions.map(c => ({
      name: c.name,
      description: c.description,
      severity: c.severity
    })),
    medicines,
    precautions,
    recommended_specialty: specialty,
    recommended_doctors: recommendedDoctors,
    summary
  };
}

module.exports = { analyzeSymptoms, detectConditions };

