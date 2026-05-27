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

const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
const { ChatPromptTemplate, MessagesPlaceholder } = require("@langchain/core/prompts");
const { StringOutputParser } = require("@langchain/core/output_parsers");

async function analyzeSymptoms(symptomsText = "", history = []) {
  const text = String(symptomsText).trim();
  
  // Base local data fallback
  const specialty = findSpecialization(text) || "General Physician";
  const medicines = suggestMedicines(text);
  const conditions = detectConditions(text);
  const precautions = getPrecautions(text);
  const summary = [
    `Based on your reported symptoms, possible conditions include: ${conditions.map(c => c.name).join(", ")}.`,
    `Recommended specialist: ${specialty}.`,
    `Suggested care: ${medicines.slice(0, 3).join(", ")}.`,
    "This is an AI-assisted guide — please consult a licensed doctor for diagnosis."
  ].join(" ");

  const localAnalysis = {
    symptoms: text,
    possible_conditions: conditions.map(c => ({
      name: c.name,
      description: c.description,
      severity: c.severity
    })),
    medicines,
    precautions,
    recommended_specialty: specialty,
    recommended_doctors: [],
    summary
  };

  const hasApiKey = process.env.GEMINI_API_KEY && 
                    process.env.GEMINI_API_KEY !== "your_gemini_api_key_here" && 
                    process.env.GEMINI_API_KEY.trim() !== "";

  let finalAnalysis = localAnalysis;

  if (hasApiKey) {
    try {
      const model = new ChatGoogleGenerativeAI({
        apiKey: process.env.GEMINI_API_KEY,
        model: "gemini-1.5-flash",
        maxOutputTokens: 1000,
      });

      const prompt = ChatPromptTemplate.fromMessages([
        ["system", `You are an expert AI clinical medical assistant. Provide clear, professional, and highly accurate medical advice.
Always output structured JSON matching the requested fields without any wrapping text or markdown blocks.
Crucially, if the patient provides biometric or optical scan results (Blood Pressure, Heart Rate, SpO2, Stress Level), you MUST analyze each metric individually:
1. Explain what the value means clinically (normal, elevated, low).
2. Compare them against standard ranges (Heart Rate: 60-100 BPM is normal; SpO2: 95-100% is normal; Blood Pressure: 120/80 is ideal, >130 systolic or >80 diastolic is elevated; Stress: 1-50 is normal, 51-100 is elevated/high).
3. If any metrics are elevated or high, provide soothing and reassuring advice, including breathing exercises, physical rest, hydration, or activating Solfeggio binaural frequencies.
4. In the "summary" key of your JSON, write a comforting, highly empathetic, and bilingual (mix of Hindi/Hinglish and English where appropriate, e.g. "Aapka blood pressure 135/88 thoda elevated hai...") explanation of the vitals and recommended next steps, so that the patient feels reassured when it is read aloud or displayed.`],
        new MessagesPlaceholder("history"),
        ["human", `Analyze the following symptoms/telemetry and respond ONLY with a valid JSON object containing:
- recommended_specialty: Choose from "General Physician", "Cardiologist", "ENT", "Dermatologist", "Ophthalmologist", "Dentist", "Neurologist", "Orthopedic", "Gastroenterologist", "Endocrinologist", "Pediatrician", "Gynecologist" based on symptoms.
- possible_conditions: Array of objects with keys "name", "description", "severity" (low, moderate, or high).
- medicines: Array of safe self-care OTC medicines or clinical actions (e.g. Paracetamol, ORS).
- precautions: Array of advice steps.
- summary: A professional and comforting summary paragraph advising doctor consultation, explaining the captured vitals details bilingually and empathetically.

Patient symptoms/input: "{input}"`]
      ]);

      const chain = prompt.pipe(model).pipe(new StringOutputParser());

      const response = await chain.invoke({ 
        input: text,
        history: history
      });
      
      // Clean possible markdown code blocks if any
      let cleanedResponse = response.trim();
      if (cleanedResponse.startsWith("```json")) {
        cleanedResponse = cleanedResponse.substring(7, cleanedResponse.length - 3).trim();
      } else if (cleanedResponse.startsWith("```")) {
        cleanedResponse = cleanedResponse.substring(3, cleanedResponse.length - 3).trim();
      }

      const parsed = JSON.parse(cleanedResponse);
      if (parsed.recommended_specialty) {
        finalAnalysis = {
          symptoms: text,
          possible_conditions: parsed.possible_conditions || localAnalysis.possible_conditions,
          medicines: parsed.medicines || localAnalysis.medicines,
          precautions: parsed.precautions || localAnalysis.precautions,
          recommended_specialty: parsed.recommended_specialty,
          recommended_doctors: [],
          summary: parsed.summary || localAnalysis.summary
        };
      }
    } catch (err) {
      console.warn("⚠️ Google Gemini API error, falling back to local NLP engine:", err.message);
    }
  }

  // Common: Populate recommended doctors based on recommended_specialty
  try {
    let doctors = await doctorModel.searchDoctorsAdvanced({
      specialization: finalAnalysis.recommended_specialty,
      sort: "rating"
    });
    
    if (!doctors || doctors.length === 0) {
      doctors = await doctorModel.searchDoctorsAdvanced({
        search: finalAnalysis.recommended_specialty,
        sort: "rating"
      });
    }
    
    if (!doctors || doctors.length === 0) {
      doctors = await doctorModel.getAllDoctors();
    }
    
    finalAnalysis.recommended_doctors = (doctors || []).slice(0, 3).map(d => ({
      doctor_id: d._id || d.id,
      name: d.name,
      specialization: d.specialization || "General Physician",
      fees: d.fees
    }));
  } catch (e) {
    finalAnalysis.recommended_doctors = [];
  }

  return finalAnalysis;
}

module.exports = { analyzeSymptoms, detectConditions };

