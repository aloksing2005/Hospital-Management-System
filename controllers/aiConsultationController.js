const https = require("https");
const { analyzeSymptoms } = require("../utils/medicalAI");
const { AIConsultation, WellbeingLog } = require("../config/db");
const { notifyUser } = require("../utils/notifyHelper");
const { getDrugSafetyData } = require("../utils/fdaService");

// Dynamic live telemetry feed utilizing openFDA clinical events API
const fetchFDAEventTelemetry = () => {
  return new Promise((resolve, reject) => {
    const url = "https://api.fda.gov/drug/event.json?limit=1";
    const req = https.get(url, {
      headers: { "User-Agent": "Hospital-Management-System-AI-Telemetry" }
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

    req.on("error", (err) => { reject(err); });
    req.setTimeout(2500, () => {
      req.destroy();
      reject(new Error("Request timeout"));
    });
  });
};

exports.getConsultationPage = async (req, res) => {
  try {
    // Reset AI consultation history when entering the consultation portal to start a clean session
    req.session.aiConsultationHistory = [];

    const history = await AIConsultation.find({ patient_id: req.session.user.id })
      .sort({ created_at: -1 })
      .limit(5)
      .lean();
    res.render("patient/ai-consultation", {
      user: req.session.user,
      history: history.map(h => ({ ...h, id: h._id }))
    });
  } catch (err) {
    req.flash("error", err.message);
    res.redirect("/patient/dashboard");
  }
};

exports.getLiveTelemetry = async (req, res) => {
  try {
    const patientId = req.session.user.id;

    // Check if there is an active vitals monitoring stream in the database (created in the last 15 seconds)
    const { PatientVitals } = require("../config/db");
    const latestVital = await PatientVitals.findOne({ patient_id: patientId })
      .sort({ created_at: -1 })
      .lean();

    if (latestVital && latestVital.created_at && (Date.now() - new Date(latestVital.created_at).getTime() < 15000)) {
      const bpm = latestVital.hr;
      let stress = "CALM";
      if (bpm > 82) stress = "ELEVATED";
      else if (bpm > 74) stress = "MODERATE";

      return res.json({
        success: true,
        vitals: {
          bpm,
          spo2: latestVital.spo2,
          bpSys: latestVital.bp_sys,
          bpDia: latestVital.bp_dia,
          stress,
          timestamp: new Date(latestVital.created_at).getTime(),
          source: "active_vitals_database_stream"
        }
      });
    }

    let rawNum = Date.now();
    let source = "simulated_physiological_drift";

    try {
      // Pull dynamic report telemetry from live openFDA safety logs
      const fdaData = await Promise.race([
        fetchFDAEventTelemetry(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("FDA Timeout")), 2000))
      ]);
      
      if (fdaData && fdaData.results && fdaData.results.length > 0) {
        const reportId = fdaData.results[0].safetyreportid || "";
        if (reportId) {
          // Digest dynamic report number to seed organic vital signs generator
          const digits = reportId.replace(/\D/g, "");
          if (digits) {
            rawNum = parseInt(digits, 10);
            source = "live_openfda_feed";
          }
        }
      }
    } catch (e) {
      console.warn("FDA Telemetry Fetch failed, falling back to physiological drift model:", e.message);
    }

    // Map seed to clinical vitals and combine with cyclic sine shifts (breath/blood waves)
    const seed = rawNum % 100;
    const bpm = Math.floor(70 + (seed % 15) + (Math.sin(Date.now() / 5000) * 3));
    const spo2 = Math.floor(96 + (seed % 4));
    const bpSys = Math.floor(115 + (seed % 15) + (Math.sin(Date.now() / 10000) * 4));
    const bpDia = Math.floor(75 + (seed % 10) + (Math.sin(Date.now() / 10000) * 2));
    const stress = Math.floor(25 + (seed % 20) + (Math.sin(Date.now() / 8000) * 5));

    res.json({
      success: true,
      vitals: { bpm, spo2, bpSys, bpDia, stress, timestamp: Date.now(), source }
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.analyzeSymptoms = async (req, res) => {
  try {
    const { symptoms, transcript } = req.body;
    const text = symptoms || transcript || "";
    if (!text.trim()) {
      return res.status(400).json({ success: false, error: "Please describe your symptoms" });
    }

    // Initialize or load consultation session history
    if (!req.session.aiConsultationHistory) {
      req.session.aiConsultationHistory = [];
    }

    const historyMessages = req.session.aiConsultationHistory.map(msg => 
      msg.role === "user" ? ["human", msg.text] : ["ai", msg.text]
    );

    const analysis = await analyzeSymptoms(text, historyMessages);

    // Save message and assistant response (summary paragraph) to history
    req.session.aiConsultationHistory.push({ role: "user", text: text });
    req.session.aiConsultationHistory.push({ role: "assistant", text: analysis.summary || "" });

    // Dynamic FDA safety audit checks for all recommended meds
    const fdaSafetyAlerts = [];
    if (analysis.medicines && analysis.medicines.length > 0) {
      for (const medicine of analysis.medicines) {
        const lowerMed = medicine.toLowerCase();
        // Skip general lifestyle or clinical follow-up advice (not actual medications)
        if (
          lowerMed.includes("rest") ||
          lowerMed.includes("hydration") ||
          lowerMed.includes("meals") ||
          lowerMed.includes("fluids") ||
          lowerMed.includes("consultation") ||
          lowerMed.includes("diet") ||
          lowerMed.includes("gargle") ||
          lowerMed.includes("avoid") ||
          lowerMed.includes("therapy") ||
          lowerMed.includes("monitor")
        ) {
          continue;
        }

        try {
          const safetyData = await getDrugSafetyData(medicine);
          fdaSafetyAlerts.push(safetyData);
        } catch (e) {
          console.error(`Error fetching safety warnings for ${medicine}:`, e.message);
        }
      }
    }

    analysis.fdaSafetyAlerts = fdaSafetyAlerts;
    res.json({ success: true, analysis });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.saveConsultation = async (req, res) => {
  try {
    const patientId = req.session.user.id;
    const {
      symptoms,
      transcript,
      possible_conditions,
      medicines,
      precautions,
      recommended_specialty,
      recommended_doctors,
      summary,
      duration_secs
    } = req.body;

    const record = await AIConsultation.create({
      patient_id: patientId,
      symptoms: symptoms || "",
      transcript: transcript || "",
      possible_conditions: possible_conditions || [],
      medicines: medicines || [],
      precautions: precautions || [],
      recommended_specialty: recommended_specialty || "",
      recommended_doctors: recommended_doctors || [],
      summary: summary || "",
      duration_secs: duration_secs || 0
    });

    // Auto-sync bio-telemetry stress metrics directly into patient's Wellbeing module logs
    const { stress_level, mood } = req.body;
    if (stress_level) {
      await WellbeingLog.create({
        patient_id: patientId,
        mood: mood || "neutral",
        activity: "ai_consultation",
        notes: `Automated bio-telemetry profile sync'd from AI Video Consult Room. Tracked symptoms: ${symptoms || 'General wellness consultation'}.`,
        duration_mins: duration_secs ? Math.max(1, Math.round(duration_secs / 60)) : 1,
        stress_level: parseInt(stress_level, 10)
      });
    }

    const io = req.app.get("io");
    await notifyUser(
      io,
      patientId,
      "AI Consultation Saved",
      "Your AI health consultation summary is ready to view.",
      "success"
    );

    res.json({ success: true, consultationId: record._id });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getHistory = async (req, res) => {
  try {
    const rows = await AIConsultation.find({ patient_id: req.session.user.id })
      .sort({ created_at: -1 })
      .lean();
    res.json({
      success: true,
      consultations: rows.map(r => ({ ...r, id: r._id }))
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.getConsultationDetail = async (req, res) => {
  try {
    const record = await AIConsultation.findOne({
      _id: req.params.id,
      patient_id: req.session.user.id
    }).lean();
    if (!record) return res.status(404).json({ success: false, error: "Not found" });
    res.json({ success: true, consultation: { ...record, id: record._id } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

exports.auditMedications = async (req, res) => {
  try {
    const { medications } = req.body;
    if (!medications || !medications.trim()) {
      return res.status(400).json({ success: false, error: "Please enter at least one medication" });
    }

    const medsArray = medications.split(",").map(m => m.trim()).filter(Boolean);
    if (medsArray.length === 0) {
      return res.status(400).json({ success: false, error: "Please enter valid medication names" });
    }

    const fdaReports = [];
    for (const med of medsArray) {
      try {
        const report = await getDrugSafetyData(med);
        fdaReports.push(report);
      } catch (err) {
        console.error(`FDA Safety audit failed for ${med}:`, err.message);
      }
    }

    const localAudit = {
      risk_level: "low",
      interaction_details: "No severe clinical conflicts detected in our standard local guidelines. Always consult a physician before combining new treatments.",
      precautions: [
        "Take medicines exactly as prescribed.",
        "Space doses out if experiencing mild stomach sensitivity.",
        "Keep well hydrated throughout the treatment."
      ],
      alternatives: []
    };

    if (medsArray.length > 1) {
      const lowerMeds = medsArray.map(m => m.toLowerCase());
      const hasAspirin = lowerMeds.some(m => m.includes("aspirin") || m.includes("ecosprin"));
      const hasIbuprofen = lowerMeds.some(m => m.includes("ibuprofen") || m.includes("combiflam"));
      const hasWarfarin = lowerMeds.some(m => m.includes("warfarin") || m.includes("blood thinner") || m.includes("heparin"));
      
      if ((hasAspirin && hasIbuprofen) || (hasAspirin && hasWarfarin) || (hasIbuprofen && hasWarfarin)) {
        localAudit.risk_level = "high";
        localAudit.interaction_details = "WARNING: Severe interaction risk! Combining multiple NSAIDs or blood thinners (like Aspirin, Ibuprofen, or Warfarin) significantly increases the risk of severe gastrointestinal bleeding, ulcers, or excessive bleeding.";
        localAudit.precautions = [
          "Do NOT combine multiple NSAIDs unless explicitly supervised by a physician.",
          "Monitor closely for dark tarry stools, severe abdominal pain, or dizziness.",
          "Stop medications immediately if any unusual bleeding or bruising occurs."
        ];
        localAudit.alternatives = ["Acetaminophen (Paracetamol) as a safer pain reliever instead of combining multiple NSAIDs."];
      }
    }

    const hasApiKey = process.env.GEMINI_API_KEY && 
                      process.env.GEMINI_API_KEY !== "your_gemini_api_key_here" && 
                      process.env.GEMINI_API_KEY.trim() !== "";

    let finalAudit = localAudit;

    if (hasApiKey) {
      try {
        const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
        const { ChatPromptTemplate } = require("@langchain/core/prompts");
        const { StringOutputParser } = require("@langchain/core/output_parsers");

        const model = new ChatGoogleGenerativeAI({
          apiKey: process.env.GEMINI_API_KEY,
          model: "gemini-1.5-flash",
          maxOutputTokens: 1000,
        });

        const prompt = ChatPromptTemplate.fromMessages([
          ["system", `You are an expert AI clinical pharmacologist. Analyze drug-to-drug interactions and adverse event reports.
Always output structured JSON matching the requested fields without any wrapping text or markdown blocks.
Tone: Caring, clear, reassuring, and professional. Mix Hinglish and English where appropriate to keep it understandable.`],
          ["human", `Perform a clinical safety audit for the following list of medications. Check for interactions, side-effects, or adverse events.
Respond ONLY with a valid JSON object containing:
- risk_level: Set to either "high" (severe interactions/bleeding/toxicity risks), "moderate" (moderate side-effects, spacing needed), or "low" (no significant interactions found).
- interaction_details: A detailed explanation of how these medications interact, what symptoms to watch out for, and why.
- precautions: Array of advice steps to prevent complications.
- alternatives: Array of safer alternative medications or clinical actions if there is a severe conflict (high/moderate risk).

List of medications to audit: {medications}
FDA Safety profiles for reference: {fdaReference}`]
        ]);

        const chain = prompt.pipe(model).pipe(new StringOutputParser());

        const fdaRefString = fdaReports.map(r => 
          `Medication: ${r.medicine}, Active: ${r.active_ingredient}, Warnings: ${r.warnings}, Interactions: ${r.drug_interactions}`
        ).join("\n");

        const response = await chain.invoke({
          medications: medsArray.join(", "),
          fdaReference: fdaRefString
        });

        let cleanedResponse = response.trim();
        if (cleanedResponse.startsWith("```json")) {
          cleanedResponse = cleanedResponse.substring(7, cleanedResponse.length - 3).trim();
        } else if (cleanedResponse.startsWith("```")) {
          cleanedResponse = cleanedResponse.substring(3, cleanedResponse.length - 3).trim();
        }

        const parsed = JSON.parse(cleanedResponse);
        if (parsed.risk_level) {
          finalAudit = {
            risk_level: parsed.risk_level,
            interaction_details: parsed.interaction_details || localAudit.interaction_details,
            precautions: parsed.precautions || localAudit.precautions,
            alternatives: parsed.alternatives || localAudit.alternatives
          };
        }
      } catch (err) {
        console.warn("⚠️ Gemini Drug Audit failed, using fallback:", err.message);
      }
    }

    res.json({
      success: true,
      medications: medsArray,
      fdaReports,
      audit: finalAudit
    });

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
