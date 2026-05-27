const http = require("http");

const BASE_URL = "http://localhost:3001";

// Helper function to make HTTP requests and handle session cookies
function request(path, method = "GET", body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        ...headers
      }
    };

    let postData = "";
    if (body) {
      if (typeof body === "object") {
        postData = Object.keys(body)
          .map(k => encodeURIComponent(k) + "=" + encodeURIComponent(body[k]))
          .join("&");
        options.headers["Content-Type"] = "application/x-www-form-urlencoded";
      } else {
        postData = body;
        options.headers["Content-Type"] = "application/json";
      }
      options.headers["Content-Length"] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", chunk => {
        data += chunk;
      });
      res.on("end", () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on("error", (err) => {
      reject(err);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

// Function to log in a role and return the cookie
async function loginAs(role) {
  console.log(`\nLogging in as ${role.toUpperCase()}...`);
  try {
    const res = await request("/auth/quick-login", "POST", { role });
    if (res.statusCode !== 302) {
      throw new Error(`Login failed with status ${res.statusCode}: ${res.body}`);
    }
    const cookies = res.headers["set-cookie"];
    if (!cookies || cookies.length === 0) {
      throw new Error("No session cookie set in login response headers");
    }
    // Extract the hms.sid cookie
    const sidCookie = cookies.find(c => c.startsWith("hms.sid="));
    if (!sidCookie) {
      throw new Error("hms.sid cookie not found in response");
    }
    const cookie = sidCookie.split(";")[0];
    console.log(`✅ Logged in successfully! Session Cookie: ${cookie}`);
    return cookie;
  } catch (err) {
    console.error(`❌ Login failed for ${role}:`, err.message);
    throw err;
  }
}

// Test routes for a given role
async function testRoutes(role, routes) {
  const cookie = await loginAs(role);
  let failed = 0;

  for (const route of routes) {
    process.stdout.write(`Testing [${role.toUpperCase()}] ${route} ... `);
    try {
      const res = await request(route, "GET", null, { Cookie: cookie });
      if (res.statusCode === 200) {
        console.log(`🟢 OK (200, length: ${res.body.length})`);
      } else if (res.statusCode === 302) {
        console.log(`🟡 Redirect (302 -> ${res.headers.location})`);
      } else {
        console.log(`🔴 FAILED (${res.statusCode})`);
        failed++;
      }
    } catch (err) {
      console.log(`🔴 CRASHED (${err.message})`);
      failed++;
    }
  }
  return failed;
}

// Main execution block
async function run() {
  console.log("=== HMS PREMIUM E2E ROUTING TEST VERIFIER ===");
  
  const patientRoutes = [
    "/patient/dashboard",
    "/patient/doctors",
    "/patient/appointments",
    "/patient/prescriptions",
    "/patient/lab-reports",
    "/patient/ambulance",
    "/patient/vitals",
    "/patient/notifications",
    "/patient/bills",
    "/patient/pharmacy",
    "/patient/wellbeing",
    "/patient/parking",
    "/patient/insurance",
    "/patient/ai-consultation",
    "/patient/ai-chat",
    "/patient/analytics"
  ];

  const doctorRoutes = [
    "/doctor/dashboard",
    "/doctor/profile",
    "/doctor/appointments",
    "/doctor/prescription",
    "/doctor/anatomy",
    "/doctor/chat"
  ];

  const adminRoutes = [
    "/admin/command-center",
    "/admin/dashboard",
    "/admin/doctors",
    "/admin/patients",
    "/admin/appointments",
    "/admin/reports",
    "/admin/ambulances",
    "/admin/lab-reports",
    "/admin/resources",
    "/admin/blood-bank"
  ];

  const driverRoutes = [
    "/driver/dashboard"
  ];

  let totalFailed = 0;

  try {
    totalFailed += await testRoutes("patient", patientRoutes);

    // Test the newly added Drug Safety & Interaction Checker POST endpoint
    console.log("\nTesting [PATIENT] POST /patient/ai-consultation/audit-medications...");
    const patientCookie = await loginAs("patient");
    const auditRes = await request("/patient/ai-consultation/audit-medications", "POST", JSON.stringify({
      medications: "Aspirin, Warfarin"
    }), { 
      Cookie: patientCookie
    });
    if (auditRes.statusCode === 200) {
      const parsedAudit = JSON.parse(auditRes.body);
      if (parsedAudit.success && parsedAudit.audit) {
        console.log("🟢 POST /patient/ai-consultation/audit-medications OK (200, Risk Level: " + parsedAudit.audit.risk_level + ")");
      } else {
        console.log("🔴 POST /patient/ai-consultation/audit-medications FAILED (Invalid JSON response)");
        totalFailed++;
      }
    } else {
      console.log("🔴 POST /patient/ai-consultation/audit-medications FAILED (Status: " + auditRes.statusCode + ")");
      totalFailed++;
    }

    totalFailed += await testRoutes("doctor", doctorRoutes);
    totalFailed += await testRoutes("admin", adminRoutes);
    totalFailed += await testRoutes("driver", driverRoutes);

    console.log("\n=============================================");
    if (totalFailed === 0) {
      console.log("🏆 ALL ROUTING TESTS PASSED! HMS SYSTEM STABLE.");
      process.exit(0);
    } else {
      console.error(`💥 TEST RUN COMPLETED WITH ${totalFailed} FAILURES.`);
      process.exit(1);
    }
  } catch (err) {
    console.error("Test execution aborted due to critical error:", err.message);
    process.exit(1);
  }
}

run();
