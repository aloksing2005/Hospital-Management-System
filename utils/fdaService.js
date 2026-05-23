const https = require("https");

const cachedSafetyData = {
  acetaminophen: {
    active_ingredient: "Acetaminophen (Paracetamol)",
    adverse_reactions: "Nausea, vomiting, headache, insomnia, or itching. Severe skin reactions are rare but possible.",
    contraindications: "Severe hepatic impairment or active liver disease. Hypersensitivity to acetaminophen.",
    overdosage: "Acute overdosage can cause life-threatening hepatic necrosis (liver failure). Keep out of reach of children.",
    pregnancy: "Generally considered safe for short-term use during pregnancy under medical supervision. Consult a doctor.",
    warnings: "Liver warning: This product contains acetaminophen. Severe liver damage may occur if you take more than 4,000 mg in 24 hours.",
    drug_interactions: "Increased risk of liver toxicity when combined with alcohol. May interact with warfarin or other blood thinners."
  },
  cetirizine: {
    active_ingredient: "Cetirizine Hydrochloride",
    adverse_reactions: "Drowsiness, fatigue, dry mouth, headache, sore throat, or dizziness.",
    contraindications: "Hypersensitivity to cetirizine, hydroxyzine, or any inactive ingredients.",
    overdosage: "Overdose may cause extreme somnolence, restlessness, irritability, and drowsiness.",
    pregnancy: "Category B. Animal studies show no fetal risk, but adequate human data is not available. Use only if clearly needed.",
    warnings: "May cause significant drowsiness. Avoid alcohol and other central nervous system depressants. Be cautious when operating machinery.",
    drug_interactions: "Avoid concurrent use with alcohol, sedatives, or tranquilizers as it may increase drowsiness and impairment."
  },
  dextromethorphan: {
    active_ingredient: "Dextromethorphan Hydrobromide",
    adverse_reactions: "Mild drowsiness, dizziness, lightheadedness, nausea, or abdominal discomfort.",
    contraindications: "Do not use if you are currently taking a prescription monoamine oxidase inhibitor (MAOI) or within 2 weeks of stopping.",
    overdosage: "Severe overdose can cause confusion, respiratory depression, rapid heart rate, hallucinations, or seizures.",
    pregnancy: "Consult a doctor. Not fully evaluated for pregnancy risks; use only if benefits outweigh risks.",
    warnings: "Do not use for persistent or chronic cough, such as occurs with smoking, asthma, or emphysema.",
    drug_interactions: "Contraindicated with MAOIs. May interact with SSRIs, SNRIs, or other serotonergic medications."
  },
  ibuprofen: {
    active_ingredient: "Ibuprofen",
    adverse_reactions: "Stomach upset, mild dyspepsia, nausea, headache, dizziness, increased blood pressure, or fluid retention.",
    contraindications: "Hypersensitivity to NSAIDs. History of asthma or hives after taking aspirin. Coronary artery bypass graft (CABG) surgery period.",
    overdosage: "Can cause abdominal pain, vomiting, lethargy, drowsiness, gastrointestinal bleeding, or acute kidney injury.",
    pregnancy: "WARNING: Avoid use in late pregnancy (third trimester) as it may cause premature closure of the fetal ductus arteriosus.",
    warnings: "Stomach bleeding warning: NSAIDs may cause severe stomach bleeding. Cardiovascular risk: May increase risk of heart attack or stroke.",
    drug_interactions: "Interacts with aspirin, anticoagulants (warfarin), oral corticosteroids, SSRIs, and antihypertensive drugs (ACE inhibitors)."
  },
  aspirin: {
    active_ingredient: "Aspirin (Acetylsalicylic Acid)",
    adverse_reactions: "Dyspepsia, heartburn, nausea, gastrointestinal irritation, increased bleeding tendency, or tinnitus.",
    contraindications: "Known allergy to NSAIDs. Bleeding disorders (hemophilia). Active peptic ulcer. Kids or teenagers recovering from viral infections (Reye's syndrome risk).",
    overdosage: "Salicylate toxicity can cause hyperventilation, tinnitus, hearing loss, confusion, fever, metabolic acidosis, or seizures.",
    pregnancy: "WARNING: Do not use in the third trimester of pregnancy unless specifically directed by a doctor due to maternal and fetal risks.",
    warnings: "Reye's syndrome: Children and teenagers who have or are recovering from chickenpox or flu-like symptoms should not use this product.",
    drug_interactions: "Highly interactive with blood thinners (warfarin, heparin), NSAIDs, oral hypoglycemics, and corticosteroids."
  },
  pantoprazole: {
    active_ingredient: "Pantoprazole Sodium",
    adverse_reactions: "Headache, diarrhea, nausea, abdominal pain, flatulence, dizziness, or joint pain.",
    contraindications: "Known hypersensitivity to proton pump inhibitors (PPIs) or any components of the formulation.",
    overdosage: "Overdoses are rare but may lead to mild systemic symptoms. Treatment is supportive and symptomatic.",
    pregnancy: "Category B. Animal studies show no risk, but no adequate human studies exist. Use only if clearly indicated.",
    warnings: "Gastric malignancy risk may be masked. Long-term use may lead to hypomagnesemia, osteoporosis-related fractures, or Vitamin B12 deficiency.",
    drug_interactions: "May reduce the absorption of drugs dependent on gastric pH (ketoconazole, atazanavir). May increase warfarin levels."
  },
  dicyclomine: {
    active_ingredient: "Dicyclomine Hydrochloride",
    adverse_reactions: "Dry mouth, blurred vision, dizziness, drowsiness, nausea, weakness, or nervousness.",
    contraindications: "Obstructive uropathy, severe ulcerative colitis, reflux esophagitis, glaucoma, myasthenia gravis, or unstable cardiovascular status.",
    overdosage: "Can cause hot, dry skin, dilated pupils, fever, rapid heart rate, confusion, hallucinations, or respiratory distress.",
    pregnancy: "Category B. Generally safe but should only be used if clearly needed under clinical supervision.",
    warnings: "May cause drowsiness or blurred vision; exercise caution when driving. May cause heat prostration in high temperatures.",
    drug_interactions: "Anticholinergic effects may be enhanced by antihistamines, phenothiazines, MAOIs, or tricyclic antidepressants."
  },
  chloroquine: {
    active_ingredient: "Chloroquine Phosphate",
    adverse_reactions: "Nausea, vomiting, diarrhea, abdominal cramps, headache, pruritus, visual disturbances, or hair loss.",
    contraindications: "Known hypersensitivity, presence of retinal or visual field changes (unless used for acute malaria treatment).",
    overdosage: "Extremely toxic in overdose. Can cause cardiovascular collapse, arrhythmias, seizures, or respiratory arrest within hours.",
    pregnancy: "Use only for malaria treatment/prevention when benefits outweigh risks, as untreated malaria carries high risk.",
    warnings: "Cardiomyopathy, QT prolongation, muscle weakness, and irreversible retinal damage with long-term high-dose therapy.",
    drug_interactions: "Antacids may reduce absorption. Avoid co-administration with other QT-prolonging drugs or cimetidine."
  }
};

function getActiveIngredient(medName) {
  if (!medName) return null;
  const name = medName.toLowerCase();
  if (name.includes("paracetamol") || name.includes("crocin") || name.includes("calpol") || name.includes("acetaminophen")) {
    return "acetaminophen";
  }
  if (name.includes("cetirizine")) return "cetirizine";
  if (name.includes("dextromethorphan")) return "dextromethorphan";
  if (name.includes("ibuprofen") || name.includes("combiflam")) return "ibuprofen";
  if (name.includes("aspirin") || name.includes("ecosprin")) return "aspirin";
  if (name.includes("pantoprazole") || name.includes("pantocid")) return "pantoprazole";
  if (name.includes("dicyclomine") || name.includes("meftal")) return "dicyclomine";
  if (name.includes("chloroquine")) return "chloroquine";
  
  // Extract first word as fallback if it's an alphabetic string
  const match = name.match(/^[a-z]+/);
  return match ? match[0] : null;
}

function fetchFromFDA(ingredient) {
  return new Promise((resolve, reject) => {
    // We add a User-Agent or standard headers, openFDA doesn't strictly require API keys for low-frequency queries
    const url = `https://api.fda.gov/drug/label.json?search=active_ingredient:"${encodeURIComponent(ingredient)}"&limit=1`;
    const req = https.get(url, {
      headers: {
        "User-Agent": "Hospital-Management-System-AI-Telemetry"
      }
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        if (res.statusCode === 200) {
          try {
            const parsed = JSON.parse(data);
            resolve(parsed);
          } catch (e) {
            reject(new Error("Failed to parse FDA response"));
          }
        } else {
          reject(new Error(`FDA API returned status code ${res.statusCode}`));
        }
      });
    });
    
    req.on("error", (err) => {
      reject(err);
    });
    
    req.setTimeout(3000, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
  });
}

async function getDrugSafetyData(medicineName) {
  const ingredient = getActiveIngredient(medicineName);
  if (!ingredient) {
    return {
      medicine: medicineName,
      active_ingredient: "Unknown Active Ingredient",
      source: "fallback",
      adverse_reactions: "No specific FDA data found. Use as directed by a healthcare professional.",
      contraindications: "No specific FDA contraindications recorded.",
      overdosage: "Standard drug safety warnings apply. In case of overdose, contact emergency services.",
      pregnancy: "Consult with a physician or pharmacist before use.",
      warnings: "Standard safety warnings apply. Discontinue use if allergic reactions occur.",
      drug_interactions: "Consult a healthcare provider before taking with other medications."
    };
  }

  const cached = cachedSafetyData[ingredient] || null;

  // Implement dynamic fetching with timeout and retry logic
  let attempts = 2;
  while (attempts > 0) {
    try {
      const response = await Promise.race([
        fetchFromFDA(ingredient),
        new Promise((_, reject) => setTimeout(() => reject(new Error("FDA Timeout")), 3500))
      ]);

      if (response && response.results && response.results.length > 0) {
        const result = response.results[0];
        
        // Helper to format fields which are usually arrays of strings
        const extractField = (fields) => {
          if (!fields) return null;
          if (Array.isArray(fields)) {
            return fields.map(f => f.replace(/\s+/g, ' ').trim()).join(" ");
          }
          return String(fields).replace(/\s+/g, ' ').trim();
        };

        const details = {
          medicine: medicineName,
          active_ingredient: result.openfda?.generic_name?.[0] || ingredient.toUpperCase(),
          source: "live_fda",
          adverse_reactions: extractField(result.adverse_reactions) || extractField(result.adverse_reactions_table) || (cached ? cached.adverse_reactions : "No details found."),
          contraindications: extractField(result.contraindications) || extractField(result.contraindications_table) || (cached ? cached.contraindications : "No details found."),
          overdosage: extractField(result.overdosage) || extractField(result.overdosage_table) || (cached ? cached.overdosage : "No details found."),
          pregnancy: extractField(result.pregnancy) || extractField(result.nursing_mothers) || extractField(result.pregnancy_or_breast_feeding) || (cached ? cached.pregnancy : "No details found."),
          warnings: extractField(result.boxed_warning) || extractField(result.warnings) || extractField(result.warnings_and_precautions) || extractField(result.general_precautions) || (cached ? cached.warnings : "No details found."),
          drug_interactions: extractField(result.drug_interactions) || extractField(result.drug_interactions_table) || (cached ? cached.drug_interactions : "No details found.")
        };

        // Truncate fields if excessively long to prevent huge JSON loads, but keep them descriptive
        for (const key of ['adverse_reactions', 'contraindications', 'overdosage', 'pregnancy', 'warnings', 'drug_interactions']) {
          if (details[key] && details[key].length > 400) {
            details[key] = details[key].substring(0, 397) + "...";
          }
        }
        return details;
      }
    } catch (err) {
      console.warn(`FDA API fetch failed for ${ingredient} (Attempts left: ${attempts - 1}):`, err.message);
    }
    attempts--;
  }

  // Fallback to cached/pre-built data
  console.log(`Using cached/fallback safety data for ${ingredient}`);
  return {
    medicine: medicineName,
    active_ingredient: cached ? cached.active_ingredient : ingredient.toUpperCase(),
    source: "fallback",
    adverse_reactions: cached ? cached.adverse_reactions : "No details found. Use as directed by a healthcare professional.",
    contraindications: cached ? cached.contraindications : "No specific FDA contraindications recorded.",
    overdosage: cached ? cached.overdosage : "Standard drug safety warnings apply. In case of overdose, contact emergency services.",
    pregnancy: cached ? cached.pregnancy : "Consult with a physician or pharmacist before use.",
    warnings: cached ? cached.warnings : "Standard safety warnings apply. Discontinue use if allergic reactions occur.",
    drug_interactions: cached ? cached.drug_interactions : "Consult a healthcare provider before taking with other medications."
  };
}

module.exports = { getDrugSafetyData };
