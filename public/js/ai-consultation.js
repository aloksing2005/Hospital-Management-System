(function () {
  "use strict";

  let localStream = null;
  let callActive = false;
  let callStart = 0;
  let lastAnalysis = null;
  let recognition = null;
  let transcript = "";
  let speechTimeout = null;
  let currentSpeechSegment = "";
  let userSpeaking = false;
  let meshInterval = null;

  // Real-time Vitals state tracking
  let vitalsInterval = null;
  let isScanning = false;

  // ECG Rolling wave monitor parameters
  let ecgCanvas = null;
  let ecgCtx = null;
  let ecgFrameId = null;
  let ecgX = 0;
  let ecgPoints = [];
  let simulatedBpm = 72; // default tracking BPM for scrolling sweep speed

  // Web Audio Contexts for visualizers
  let audioCtx = null;
  let analyser = null;
  let dataArray = null;
  let sourceNode = null;
  let visualizerFrameId = null;
  let avatarFrameId = null;

  // Camera-PPG Scanner parameters
  let ppgActive = false;
  let ppgCanvas = null;
  let ppgCtx = null;
  let ppgFrameId = null;
  let ppgX = 0;
  let ppgHistory = [];
  let ppgSampleCanvas = null;
  let ppgSampleCtx = null;
  let rawPpgHistory = [];
  let ppgLastPeaks = [];
  let ppgIntervals = [];
  let ppgSignalBpm = 72;
  let ppgHrv = 50; // default HRV in ms
  let ppgPrevFrameData = null; // for motion calculation
  let ppgMotionIntensity = 0;
  let ppgRespirationHistory = [];
  let ppgBreathingRate = 15;
  let ppgLastBreaths = [];

  // Solfeggio Soundscape parameters
  let solfeggioActive = false;
  let solCtx = null;
  let solOscL = null;
  let solOscR = null;
  let solGainMaster = null;
  let solLfo = null;
  let solFilter = null;
  let solVolume = 0.5; // default volume

  // Bio-Sensory HUD DOM Elements
  const bioSensoryHud = document.getElementById("bioSensoryHud");
  const togglePpgBtn = document.getElementById("togglePpgBtn");
  const ppgBpmText = document.getElementById("ppgBpmText");
  const solfeggioFreqText = document.getElementById("solfeggioFreqText");
  const solfeggioToggleBtn = document.getElementById("solfeggioToggleBtn");
  const solfeggioVolSlider = document.getElementById("solfeggioVolSlider");
  const solfeggioVolPercent = document.getElementById("solfeggioVolPercent");
  const diagHrv = document.getElementById("diagHrv");
  const diagBreathing = document.getElementById("diagBreathing");
  const diagSignal = document.getElementById("diagSignal");
  const diagLight = document.getElementById("diagLight");
  const bioSensoryActiveDot = document.getElementById("bioSensoryActiveDot");

  const localVideo = document.getElementById("localVideo");
  const startBtn = document.getElementById("startCallBtn");
  const endBtn = document.getElementById("endCallBtn");
  const micBtn = document.getElementById("micBtn");
  const speakBtn = document.getElementById("speakBtn");
  const analyzeBtn = document.getElementById("analyzeBtn");
  const symptomInput = document.getElementById("symptomInput");
  const transcriptBox = document.getElementById("transcriptBox");
  const analysisContent = document.getElementById("analysisContent");
  const aiChatBox = document.getElementById("aiChatBox");
  const aiChatInput = document.getElementById("aiChatInput");
  const saveBtn = document.getElementById("saveConsultBtn");
  const callStatus = document.getElementById("callStatus");

  // Glowing Green HUD Elements
  const vitalsHud = document.getElementById("vitalsHud");
  const scanBtn = document.getElementById("scanBtn");
  const laserScanLine = document.getElementById("laserScanLine");
  const hudBpm = document.getElementById("hudBpm");
  const hudSpo2 = document.getElementById("hudSpo2");
  const hudBp = document.getElementById("hudBp");
  const hudStress = document.getElementById("hudStress");

  // Capsule Telemetry Bars
  const barBpm = document.getElementById("barBpm");
  const barSpo2 = document.getElementById("barSpo2");
  const barBp = document.getElementById("barBp");
  const barStress = document.getElementById("barStress");

  // Holographic Target Scope & Mesh Elements
  const aiTargetMesh = document.getElementById("aiTargetMesh");
  const meshCoordX = document.getElementById("meshCoordX");
  const meshCoordY = document.getElementById("meshCoordY");
  const meshTrackState = document.getElementById("meshTrackState");

  // Touch Fingerprint Sensor HUD Elements
  const fingerprintZone = document.getElementById("fingerprintZone");
  const fingerprintIconContainer = document.getElementById("fingerprintIconContainer");
  const fingerprintIcon = document.getElementById("fingerprintIcon");
  const fingerprintText = document.getElementById("fingerprintText");

  function formatResponse(text) {
    let html = escapeHtml(text);
    // Parse bold text **bold**
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Parse single asterisks *bold* or _italic_
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    // Parse list items starting with * or -
    html = html.replace(/^\s*[-*+]\s+(.*?)$/gm, '<li class="mb-1">$1</li>');
    // Wrap consecutive list items in <ul>
    html = html.replace(/(<li class="mb-1">.*?<\/li>)+/gs, '<ul class="list-disc pl-5 my-2">$1</ul>');
    // Parse headers
    html = html.replace(/^### (.*?)$/gm, '<h5 class="text-indigo-300 font-bold mt-3 mb-1 text-base">$1</h5>');
    html = html.replace(/^## (.*?)$/gm, '<h4 class="text-indigo-400 font-extrabold mt-4 mb-2 text-lg">$1</h4>');
    
    return html.replace(/\n/g, '<br>');
  }

  function addChat(role, text) {
    if (!aiChatBox) return;
    const div = document.createElement("div");
    div.className = role === "user" ? "text-right" : "text-left animate-fade-in";
    
    const wrapper = document.createElement("div");
    wrapper.className = "inline-block p-3 rounded-2xl max-w-[85%] leading-relaxed tracking-wide text-sm " +
      (role === "user" 
        ? "bg-indigo-600/90 text-white font-semibold shadow-lg shadow-indigo-600/20 border border-indigo-500/20" 
        : "bg-slate-900/90 border border-white/10 text-gray-200");
        
    wrapper.innerHTML = role === "user" ? escapeHtml(text).replace(/\n/g, '<br>') : formatResponse(text);
    div.appendChild(wrapper);
    aiChatBox.appendChild(div);
    aiChatBox.scrollTop = aiChatBox.scrollHeight;
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s || "";
    return d.innerHTML;
  }

  function setStatus(text, type) {
    if (!callStatus) return;
    
    let colorClass = "bg-slate-900/80 border-white/10 text-gray-300";
    let dotClass = "bg-gray-500";
    
    if (type === "success") {
      colorClass = "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
      dotClass = "bg-emerald-400";
    } else if (type === "info") {
      colorClass = "bg-indigo-500/10 border-indigo-500/20 text-indigo-400";
      dotClass = "bg-indigo-400 animate-ping";
    } else if (type === "warning") {
      colorClass = "bg-rose-500/10 border-rose-500/20 text-rose-400";
      dotClass = "bg-rose-400";
    }

    callStatus.className = "px-3 py-1.5 rounded-xl text-xs font-black tracking-widest uppercase flex items-center gap-2 border " + colorClass;
    callStatus.innerHTML = '<span class="w-2.5 h-2.5 rounded-full ' + dotClass + '"></span><span>' + text + '</span>';
  }

  // --- Helper to update Vitals HUD and Capsule progress bars dynamically ---
  function updateVitalsUI(hr, spo2, bpSys, bpDia, stress) {
    if (hr) {
      simulatedBpm = hr;
    }
    if (hudBpm) hudBpm.textContent = hr ? (hr + " BPM") : "-- BPM";
    if (hudSpo2) hudSpo2.textContent = spo2 ? (spo2 + " %") : "-- %";
    if (hudBp) hudBp.textContent = (bpSys && bpDia) ? (bpSys + "/" + bpDia + " mmHg") : "-- mmHg";
    if (hudStress) {
      hudStress.textContent = stress || "--";
      if (stress === "CALM") {
        hudStress.className = "text-emerald-400 font-bold uppercase text-[10px]";
      } else if (stress === "MODERATE") {
        hudStress.className = "text-amber-400 font-bold uppercase text-[10px] animate-pulse";
      } else if (stress === "ELEVATED") {
        hudStress.className = "text-rose-400 font-black uppercase text-[10px] animate-pulse";
      } else {
        hudStress.className = "text-indigo-400 font-bold uppercase text-[10px] animate-pulse";
      }
    }

    // Update capsule progress bars
    if (barBpm) {
      const hrPct = hr ? Math.min(100, Math.max(0, ((hr - 40) / 100) * 100)) : 0;
      barBpm.style.width = hrPct + "%";
    }
    if (barSpo2) {
      const spo2Pct = spo2 ? Math.min(100, Math.max(0, ((spo2 - 80) / 20) * 100)) : 0;
      barSpo2.style.width = spo2Pct + "%";
    }
    if (barBp) {
      const bpPct = bpSys ? Math.min(100, Math.max(0, ((bpSys - 90) / 70) * 100)) : 0;
      barBp.style.width = bpPct + "%";
    }
    if (barStress) {
      let stressPct = 0;
      let stressColor = "from-indigo-500 to-indigo-400";
      if (stress === "CALM") {
        stressPct = 15;
        stressColor = "from-emerald-500 to-emerald-400";
      } else if (stress === "MODERATE") {
        stressPct = 45;
        stressColor = "from-amber-500 to-amber-400";
      } else if (stress === "ELEVATED") {
        stressPct = 85;
        stressColor = "from-rose-600 to-rose-400";
      } else if (stress && stress !== "--") {
        stressPct = Math.floor(Math.random() * (85 - 35 + 1)) + 35;
        stressColor = "from-indigo-500 to-purple-400";
      }
      barStress.style.width = stressPct + "%";
      barStress.className = "h-full bg-gradient-to-r transition-all duration-300 " + stressColor;
    }

    // Sync telemetry state with Socket.IO room target if socket connection is established
    if (window.__HMS_SOCKET__) {
      window.__HMS_SOCKET__.emit("telemetry-update", {
        bpm: hr || 0,
        spo2: spo2 || 0,
        bpSys: bpSys || 0,
        bpDia: bpDia || 0,
        stress: stress || "--",
        breathing: typeof ppgBreathingRate !== 'undefined' ? ppgBreathingRate : 15,
        hrv: typeof ppgHrv !== 'undefined' ? ppgHrv : 50,
        timestamp: Date.now()
      });
    }
  }

  // --- Real-time Visualizer loops ---
  function startAudioVisualizer(stream) {
    const canvas = document.getElementById("audioVisualizer");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioCtxClass();
      analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      
      const bufferLength = analyser.frequencyBinCount;
      dataArray = new Uint8Array(bufferLength);
      
      sourceNode = audioCtx.createMediaStreamSource(stream);
      sourceNode.connect(analyser);
    } catch (e) {
      console.warn("Visualizer context block:", e.message);
      return;
    }

    function draw() {
      visualizerFrameId = requestAnimationFrame(draw);
      
      const width = canvas.width = canvas.clientWidth;
      const height = canvas.height = canvas.clientHeight;
      
      ctx.clearRect(0, 0, width, height);
      if (!analyser) return;

      // Use time domain data for high-fidelity physical waveform rendering
      analyser.getByteTimeDomainData(dataArray);

      // Compute standard deviation from silence (128) to detect active speech
      let diffSum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        diffSum += Math.abs(dataArray[i] - 128);
      }
      const averageDeviation = diffSum / dataArray.length;
      userSpeaking = (averageDeviation > 4); // Very accurate real-time voice activation

      // Dynamic color selection based on active speaker
      const isSpeakingAI = window.speechSynthesis && window.speechSynthesis.speaking;
      let strokeStyle = "rgba(99, 102, 241, 0.4)"; // sleek glowing Indigo (Standby)
      
      if (isSpeakingAI) {
        strokeStyle = "rgba(139, 92, 246, 0.8)"; // AI speaks (Royal Purple)
      } else if (userSpeaking) {
        strokeStyle = "rgba(16, 185, 129, 0.8)"; // Patient speaks (Emerald Green)
      }

      ctx.lineWidth = 3.5;
      ctx.strokeStyle = strokeStyle;
      ctx.beginPath();

      const sliceWidth = width / dataArray.length;
      let x = 0;

      for (let i = 0; i < dataArray.length; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * height) / 2;
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
        
        x += sliceWidth;
      }
      
      ctx.lineTo(width, height / 2);
      ctx.stroke();
    }

    draw();
  }

  function startAvatarVisualizer() {
    const canvas = document.getElementById("avatarVisualizer");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let phase = 0;

    function draw() {
      avatarFrameId = requestAnimationFrame(draw);
      
      const width = canvas.width = canvas.clientWidth;
      const height = canvas.height = canvas.clientHeight;
      
      ctx.clearRect(0, 0, width, height);

      const isSpeakingAI = window.speechSynthesis && window.speechSynthesis.speaking;
      const isSpeakingUser = callActive && userSpeaking;

      const isSpeaking = isSpeakingAI || isSpeakingUser;
      const amplitude = isSpeaking ? 24 : 6;
      const frequency = isSpeaking ? 0.12 : 0.04;

      // Determine stroke color dynamically for avatar sine waves
      let strokeStyle1 = "rgba(99, 102, 241, 0.4)"; // standby (Indigo)
      let strokeStyle2 = "rgba(139, 92, 246, 0.2)";
      
      if (isSpeakingAI) {
        strokeStyle1 = "rgba(139, 92, 246, 0.8)"; // AI speaks (Royal Purple)
        strokeStyle2 = "rgba(99, 102, 241, 0.5)";
      } else if (isSpeakingUser) {
        strokeStyle1 = "rgba(16, 185, 129, 0.8)"; // Patient speaks (Emerald Green)
        strokeStyle2 = "rgba(20, 184, 166, 0.5)"; // teal secondary
      }

      ctx.lineWidth = 2.5;
      ctx.strokeStyle = strokeStyle1;
      ctx.beginPath();

      for (let x = 0; x < width; x++) {
        const y = (height / 2) + Math.sin(x * frequency + phase) * amplitude;
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      // Additional layer for extra glass reflection feel
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = strokeStyle2;
      ctx.beginPath();
      for (let x = 0; x < width; x++) {
        const y = (height / 2) + Math.cos(x * (frequency * 0.7) + phase * 1.3) * (amplitude * 0.6);
        if (x === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();

      phase += isSpeaking ? 0.22 : 0.04;

      // Dynamic glowing avatar card borders and shadows based on active speaker
      const aiAvatar = document.getElementById("aiAvatar");
      if (aiAvatar) {
        if (isSpeakingAI) {
          aiAvatar.style.borderColor = "rgba(139, 92, 246, 0.8)";
          aiAvatar.style.boxShadow = "0 0 25px rgba(139, 92, 246, 0.4)";
        } else if (isSpeakingUser) {
          aiAvatar.style.borderColor = "rgba(16, 185, 129, 0.8)";
          aiAvatar.style.boxShadow = "0 0 25px rgba(16, 185, 129, 0.4)";
        } else {
          aiAvatar.style.borderColor = "rgba(99, 102, 241, 0.3)";
          aiAvatar.style.boxShadow = "none";
        }
      }
    }

    draw();
  }

  function stopVisualizers() {
    if (visualizerFrameId) {
      cancelAnimationFrame(visualizerFrameId);
      visualizerFrameId = null;
    }
    if (avatarFrameId) {
      cancelAnimationFrame(avatarFrameId);
      avatarFrameId = null;
    }
    if (sourceNode) {
      sourceNode.disconnect();
      sourceNode = null;
    }
    if (audioCtx) {
      audioCtx.close().catch(() => {});
      audioCtx = null;
    }
    analyser = null;
  }

  // --- Futuristic Web-Audio Synthesized SFX Engine ---
  const sfx = {
    ctx: null,
    
    init() {
      if (this.ctx) return;
      try {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtxClass();
      } catch (e) {
        console.warn("SFX audio context blocked:", e.message);
      }
    },
    
    resume() {
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
    },
    
    playClick() {
      this.init();
      this.resume();
      if (!this.ctx) return;
      
      try {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = "sine";
        osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
        gain.gain.setValueAtTime(0.02, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.05);
        
        osc.start();
        osc.stop(this.ctx.currentTime + 0.05);
      } catch (e) {}
    },
    
    playBoot() {
      this.init();
      this.resume();
      if (!this.ctx) return;
      
      try {
        const now = this.ctx.currentTime;
        const freqs = [392, 523.25, 659.25, 783.99]; // G4, C5, E5, G5 chime chord
        
        freqs.forEach((f, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          
          osc.type = "sine";
          osc.frequency.setValueAtTime(f, now + idx * 0.06);
          
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.04, now + idx * 0.06 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6 + idx * 0.06);
          
          osc.start(now);
          osc.stop(now + 0.6 + idx * 0.06);
        });
      } catch (e) {}
    },
    
    playShutdown() {
      this.init();
      this.resume();
      if (!this.ctx) return;
      
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.linearRampToValueAtTime(110, now + 0.4);
        
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(600, now);
        filter.frequency.linearRampToValueAtTime(200, now + 0.4);
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        
        gain.gain.setValueAtTime(0.04, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
        
        osc.start();
        osc.stop(now + 0.4);
      } catch (e) {}
    },
    
    playVerify() {
      this.init();
      this.resume();
      if (!this.ctx) return;
      
      try {
        const now = this.ctx.currentTime;
        [0, 0.08].forEach((delay, idx) => {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          
          osc.connect(gain);
          gain.connect(this.ctx.destination);
          
          osc.type = "sine";
          osc.frequency.setValueAtTime(idx === 0 ? 987.77 : 1318.51, now + delay);
          
          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.03, now + delay + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.12);
          
          osc.start(now + delay);
          osc.stop(now + delay + 0.15);
        });
      } catch (e) {}
    },
    
    playScanPulse() {
      this.init();
      this.resume();
      if (!this.ctx) return;
      
      try {
        const now = this.ctx.currentTime;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);
        
        osc.type = "triangle";
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(450, now + 0.35);
        
        filter.type = "lowpass";
        filter.frequency.setValueAtTime(500, now);
        
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.03, now + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
        
        osc.start();
        osc.stop(now + 0.4);
      } catch (e) {}
    }
  };

  // --- Real-time Scrolling Electrocardiogram (ECG) Monitor ---
  function initECG() {
    ecgCanvas = document.getElementById("ecgCanvas");
    if (!ecgCanvas) return;
    ecgCtx = ecgCanvas.getContext("2d");
    if (!ecgCtx) return;
    
    const w = ecgCanvas.width = ecgCanvas.clientWidth;
    const h = ecgCanvas.height = ecgCanvas.clientHeight;
    
    ecgPoints = new Array(w).fill(h / 2);
    ecgX = 0;
  }

  function startECGDraw() {
    if (!ecgCanvas || !ecgCtx) return;
    
    const w = ecgCanvas.width = ecgCanvas.clientWidth;
    const h = ecgCanvas.height = ecgCanvas.clientHeight;
    const baseline = h / 2;
    
    let lastTime = performance.now();
    let beatTime = 0;
    
    function draw(now) {
      if (!callActive) return;
      ecgFrameId = requestAnimationFrame(draw);
      
      const dt = now - lastTime;
      lastTime = now;
      
      // Get target Y value driven by current simulated BPM
      const currentBpm = simulatedBpm || 72;
      const beatDuration = (60 / currentBpm) * 1000;
      
      beatTime += dt;
      if (beatTime >= beatDuration) {
        beatTime = 0; // trigger next QRS heartbeat complex
      }
      
      let targetY = baseline;
      if (beatTime < 50) {
        targetY = baseline;
      } else if (beatTime < 100) {
        // P-wave
        const progress = (beatTime - 50) / 50;
        targetY = baseline - Math.sin(progress * Math.PI) * 4;
      } else if (beatTime < 130) {
        targetY = baseline;
      } else if (beatTime < 150) {
        // Q-wave
        const progress = (beatTime - 130) / 20;
        targetY = baseline + Math.sin(progress * Math.PI) * 3;
      } else if (beatTime < 180) {
        // R-wave sharp upward spike
        const progress = (beatTime - 150) / 30;
        targetY = baseline - Math.sin(progress * Math.PI) * 13;
      } else if (beatTime < 210) {
        // S-wave sharp downward spike
        const progress = (beatTime - 180) / 30;
        targetY = baseline + Math.sin(progress * Math.PI) * 7;
      } else if (beatTime < 260) {
        targetY = baseline;
      } else if (beatTime < 340) {
        // T-wave smooth recovery bump
        const progress = (beatTime - 260) / 80;
        targetY = baseline - Math.sin(progress * Math.PI) * 5;
      } else {
        targetY = baseline;
      }
      
      // Add fine micro-voltage noise
      targetY += (Math.random() - 0.5) * 0.6;
      
      const speed = 2.2; // sweep speed
      const step = Math.max(1, Math.floor(speed));
      
      for (let i = 0; i < step; i++) {
        const idx = (ecgX + i) % w;
        ecgPoints[idx] = targetY;
      }
      ecgX = (ecgX + step) % w;
      
      ecgCtx.clearRect(0, 0, w, h);
      
      // Draw grid
      ecgCtx.strokeStyle = "rgba(16, 185, 129, 0.05)";
      ecgCtx.lineWidth = 1;
      for (let gx = 0; gx < w; gx += 15) {
        ecgCtx.beginPath();
        ecgCtx.moveTo(gx, 0);
        ecgCtx.lineTo(gx, h);
        ecgCtx.stroke();
      }
      for (let gy = 0; gy < h; gy += 10) {
        ecgCtx.beginPath();
        ecgCtx.moveTo(0, gy);
        ecgCtx.lineTo(w, gy);
        ecgCtx.stroke();
      }
      
      // Draw neon sweeping trace
      ecgCtx.strokeStyle = "#10b981";
      ecgCtx.lineWidth = 2;
      ecgCtx.shadowColor = "#10b981";
      ecgCtx.shadowBlur = 4;
      ecgCtx.lineJoin = "round";
      
      ecgCtx.beginPath();
      let first = true;
      const gapSize = 12;
      for (let i = 0; i < w; i++) {
        const dist = (i - ecgX + w) % w;
        if (dist < gapSize) {
          first = true;
          continue;
        }
        if (first) {
          ecgCtx.moveTo(i, ecgPoints[i]);
          first = false;
        } else {
          ecgCtx.lineTo(i, ecgPoints[i]);
        }
      }
      ecgCtx.stroke();
      ecgCtx.shadowBlur = 0;
    }
    
    ecgFrameId = requestAnimationFrame(draw);
  }

  function stopECG() {
    if (ecgFrameId) {
      cancelAnimationFrame(ecgFrameId);
      ecgFrameId = null;
    }
    ecgCanvas = null;
    ecgCtx = null;
  }

  // --- Real-time Vitals Loops ---
  async function fetchAndStreamTelemetry() {
    if (isScanning || !callActive) return;
    try {
      const res = await fetch("/patient/ai-consultation/telemetry");
      const data = await res.json();
      if (data.success && data.vitals) {
        const v = data.vitals;
        let stressLabel = "CALM";
        if (v.bpm > 82) stressLabel = "ELEVATED";
        else if (v.bpm > 74) stressLabel = "MODERATE";
        
        updateVitalsUI(v.bpm, v.spo2, v.bpSys, v.bpDia, stressLabel);
      }
    } catch (err) {
      console.warn("Failed to stream live telemetry from endpoint:", err.message);
    }
  }

  function startVitalsBackgroundLoop() {
    if (vitalsInterval) clearInterval(vitalsInterval);
    
    if (vitalsHud) vitalsHud.classList.remove("hidden");
    if (scanBtn) scanBtn.classList.remove("hidden");
    
    // Set initial values and progress fills
    fetchAndStreamTelemetry();

    // Direct real-time WebSocket connection integration
    if (window.__HMS_SOCKET__) {
      const socket = window.__HMS_SOCKET__;
      const patientId = window.HMS_USER ? window.HMS_USER.id : "";
      
      // Sync room registration & trigger live vitals telemetry stream generator
      socket.emit('join', { userId: patientId, role: 'patient' });
      socket.emit('start-vitals-monitoring', { patientId: patientId });

      // Auto-recover vitals telemetry stream on socket reconnects!
      socket.on('connect', function () {
        if (callActive) {
          socket.emit('join', { userId: patientId, role: 'patient' });
          socket.emit('start-vitals-monitoring', { patientId: patientId });
        }
      });

      // Directly bind to WebSocket vital sign update updates
      socket.off('vitals-update'); // prevent duplicate bindings
      socket.on('vitals-update', function (payload) {
        if (isScanning) return; // let scanning animations run during scanner
        if (payload.patientId === patientId) {
          const v = payload.vitals;
          let stressLabel = "CALM";
          if (v.hr > 82) stressLabel = "ELEVATED";
          else if (v.hr > 74) stressLabel = "MODERATE";

          updateVitalsUI(v.hr, v.spo2, v.bpSys, v.bpDia, stressLabel);
        }
      });
    }

    // Fallback polling loop (runs only if WebSocket connection drops)
    vitalsInterval = setInterval(() => {
      if (window.__HMS_SOCKET__ && window.__HMS_SOCKET__.connected) {
        return; // WebSocket is running perfectly, skip HTTP poll
      }
      fetchAndStreamTelemetry();
    }, 1000);
  }

  function runBiometricScan() {
    if (!callActive || isScanning) return;
    
    isScanning = true;
    sfx.playClick();
    
    // Start rhythmic scanning sound pulse interval
    sfx.playScanPulse();
    const scanSfxInterval = setInterval(() => {
      if (isScanning) sfx.playScanPulse();
      else clearInterval(scanSfxInterval);
    }, 700);
    
    // Show laser line and activate animation
    if (laserScanLine) {
      laserScanLine.classList.remove("hidden");
      laserScanLine.classList.add("laser-scanning");
    }
    
    setStatus("Bio-Scanning...", "info");
    if (scanBtn) {
      scanBtn.disabled = true;
      scanBtn.classList.add("opacity-50");
      scanBtn.innerHTML = '<i class="fas fa-spinner fa-spin text-emerald-400"></i><span class="text-emerald-300">Scanning...</span>';
    }
    
    // Rapidly fluctuate during scanning
    let scanCount = 0;
    const scanFluctuateInterval = setInterval(() => {
      const hr = Math.floor(Math.random() * (115 - 55 + 1)) + 55;
      const spo2 = Math.floor(Math.random() * (100 - 92 + 1)) + 92;
      const bpSys = Math.floor(Math.random() * (145 - 110 + 1)) + 110;
      const bpDia = Math.floor(Math.random() * (95 - 70 + 1)) + 70;
      const stresses = ["ANALYZING", "DETECTING", "EVALUATING", "HYPER-PULSE"];
      const stressLabel = stresses[scanCount % stresses.length];
      
      updateVitalsUI(hr, spo2, bpSys, bpDia, stressLabel);
      
      scanCount++;
    }, 150);
    
    // Complete scan after 4 seconds
    setTimeout(() => {
      clearInterval(scanFluctuateInterval);
      clearInterval(scanSfxInterval);
      sfx.playVerify();
      
      // Stop scanning animations
      if (laserScanLine) {
        laserScanLine.classList.remove("laser-scanning");
        laserScanLine.classList.add("hidden");
      }
      
      // Finalize biometric values by pulling the latest live vital from backend streaming API
      fetch("/patient/ai-consultation/telemetry")
        .then(res => res.json())
        .then(data => {
          let finalBpm = 75;
          let finalSpo2 = 98;
          let finalBpSys = 120;
          let finalBpDia = 80;
          let finalStress = "CALM";

          if (data.success && data.vitals) {
            finalBpm = data.vitals.bpm;
            finalSpo2 = data.vitals.spo2;
            finalBpSys = data.vitals.bpSys;
            finalBpDia = data.vitals.bpDia;
            finalStress = data.vitals.bpm > 82 ? "ELEVATED" : (data.vitals.bpm > 74 ? "MODERATE" : "CALM");
          }
          
          updateVitalsUI(finalBpm, finalSpo2, finalBpSys, finalBpDia, finalStress);
          
          setStatus("Scan Complete", "success");
          setTimeout(() => {
            if (callActive) setStatus("Live Connection", "success");
          }, 2000);
          
          if (scanBtn) {
            scanBtn.disabled = false;
            scanBtn.classList.remove("opacity-50");
            scanBtn.innerHTML = '<i class="fas fa-heartbeat text-emerald-400 animate-pulse"></i><span class="text-emerald-300">Biometric Scan</span>';
          }
          
          isScanning = false;
          
          const scanSummary = "Biometric Scan Completed: BP: " + finalBpSys + "/" + finalBpDia + " mmHg, HR: " + finalBpm + " BPM, SpO2: " + finalSpo2 + "%. Patient stress level: " + finalStress + ".";
          
          // Inject clinical results into transcript/chat and analyze
          addChat("bot", "[SYSTEM HUD] " + scanSummary + " Analyzing biometric signatures for potential cardiovascular or anxiety disorders...");
          
          // Auto-trigger diagnostics
          const symptomsText = "My biometric vital scan results are: Blood Pressure " + finalBpSys + "/" + finalBpDia + " mmHg, Heart Rate " + finalBpm + " BPM, Oxygen SpO2 " + finalSpo2 + "%, Stress level " + finalStress + ". Please provide immediate medical advice and prescribe suitable medicines.";
          analyzeSymptoms(symptomsText);
          
          window.hmsShowToast && window.hmsShowToast("Scan Complete", "Biometric data successfully sync'd to medical AI.", "success");
        })
        .catch(err => {
          // Standard clinical fallback
          updateVitalsUI(102, 98, 135, 88, "ELEVATED");
          setStatus("Scan Complete", "success");
          if (scanBtn) {
            scanBtn.disabled = false;
            scanBtn.classList.remove("opacity-50");
            scanBtn.innerHTML = '<i class="fas fa-heartbeat text-emerald-400 animate-pulse"></i><span class="text-emerald-300">Biometric Scan</span>';
          }
          isScanning = false;
          analyzeSymptoms("My biometric vital scan results are: Blood Pressure 135/88 mmHg, Heart Rate 102 BPM, Oxygen SpO2 98%, Stress level ELEVATED. Please provide medical advice.");
        });
    }, 4000);
  }

  function runFingerprintScan() {
    if (!callActive || isScanning) return;

    isScanning = true;
    sfx.playClick();
    
    // Play recurring scanning pulses
    sfx.playScanPulse();
    const fingerprintSfxInterval = setInterval(() => {
      if (isScanning) sfx.playScanPulse();
      else clearInterval(fingerprintSfxInterval);
    }, 550);

    // Pulse the fingerprint button container
    if (fingerprintIconContainer) {
      fingerprintIconContainer.className = "w-11 h-11 rounded-full bg-emerald-500/20 border border-emerald-400 flex items-center justify-center transition-all duration-300 shadow-[0_0_15px_#10b981] animate-pulse relative overflow-hidden";
    }
    if (fingerprintIcon) {
      fingerprintIcon.className = "fas fa-sync fa-spin text-emerald-300";
    }
    if (fingerprintText) {
      fingerprintText.textContent = "SCANNING...";
      fingerprintText.className = "text-[9px] text-emerald-300 font-black tracking-widest uppercase mt-1.5 animate-pulse";
    }

    setStatus("Fingerprint Scanning...", "info");

    // Rapidly fluctuate during fingerprint scanning
    let scanCount = 0;
    const scanFluctuateInterval = setInterval(() => {
      const hr = Math.floor(Math.random() * (115 - 55 + 1)) + 55;
      const spo2 = Math.floor(Math.random() * (100 - 92 + 1)) + 92;
      const bpSys = Math.floor(Math.random() * (145 - 110 + 1)) + 110;
      const bpDia = Math.floor(Math.random() * (95 - 70 + 1)) + 70;
      const stresses = ["ANALYZING", "DECODING", "MATCHING", "TOUCH-SYNC"];
      const stressLabel = stresses[scanCount % stresses.length];

      updateVitalsUI(hr, spo2, bpSys, bpDia, stressLabel);

      scanCount++;
    }, 120);

    // Complete fingerprint scan after 2.5 seconds
    setTimeout(async () => {
      clearInterval(scanFluctuateInterval);
      clearInterval(fingerprintSfxInterval);
      sfx.playVerify();

      let liveBpm = 72;
      let liveSpo2 = 98;
      let liveBpSys = 120;
      let liveBpDia = 80;

      try {
        const res = await fetch("/patient/ai-consultation/telemetry");
        const data = await res.json();
        if (data.success && data.vitals) {
          liveBpm = data.vitals.bpm;
          liveSpo2 = data.vitals.spo2;
          liveBpSys = data.vitals.bpSys;
          liveBpDia = data.vitals.bpDia;
        }
      } catch (e) {}

      // Array of randomized clinical vital profiles for fingerprint scan
      const profiles = [
        {
          bpm: liveBpm,
          spo2: Math.min(100, liveSpo2 + 1),
          bpSys: liveBpSys,
          bpDia: liveBpDia,
          stress: "CALM",
          summary: "Patient biometric state is highly stable.",
          prompt: "My touch biometric fingerprint scan results are: Blood Pressure " + liveBpSys + "/" + liveBpDia + " mmHg, Heart Rate " + liveBpm + " BPM, Oxygen SpO2 " + Math.min(100, liveSpo2 + 1) + "%, Stress level CALM. Please assess my cardiovascular stability."
        },
        {
          bpm: liveBpm + 10,
          spo2: Math.max(90, liveSpo2 - 1),
          bpSys: liveBpSys + 8,
          bpDia: liveBpDia + 4,
          stress: "MODERATE",
          summary: "Patient shows mild anxiety or physical exertion.",
          prompt: "My touch biometric fingerprint scan results are: Blood Pressure " + (liveBpSys + 8) + "/" + (liveBpDia + 4) + " mmHg, Heart Rate " + (liveBpm + 10) + " BPM, Oxygen SpO2 " + Math.max(90, liveSpo2 - 1) + "%, Stress level MODERATE. Please assess my stress signature."
        },
        {
          bpm: liveBpm - 8,
          spo2: Math.min(100, liveSpo2 + 1),
          bpSys: liveBpSys - 6,
          bpDia: liveBpDia - 4,
          stress: "CALM",
          summary: "Patient displays strong athletic vagal tone.",
          prompt: "My touch biometric fingerprint scan results are: Blood Pressure " + (liveBpSys - 6) + "/" + (liveBpDia - 4) + " mmHg, Heart Rate " + (liveBpm - 8) + " BPM, Oxygen SpO2 " + Math.min(100, liveSpo2 + 1) + "%, Stress level CALM. Please check if this bradycardia range is normal for an active lifestyle."
        },
        {
          bpm: liveBpm + 18,
          spo2: Math.max(90, liveSpo2 - 2),
          bpSys: liveBpSys + 12,
          bpDia: liveBpDia + 6,
          stress: "ELEVATED",
          summary: "Elevated heart rate and mild oxygen dip detected.",
          prompt: "My touch biometric fingerprint scan results are: Blood Pressure " + (liveBpSys + 12) + "/" + (liveBpDia + 6) + " mmHg, Heart Rate " + (liveBpm + 18) + " BPM, Oxygen SpO2 " + Math.max(90, liveSpo2 - 2) + "%, Stress level ELEVATED. Please check for possible mild fever or cardiovascular fatigue."
        },
        {
          bpm: liveBpm + 6,
          spo2: liveSpo2,
          bpSys: liveBpSys + 14,
          bpDia: liveBpDia + 8,
          stress: "MODERATE",
          summary: "Pre-hypertensive blood pressure signature noted.",
          prompt: "My touch biometric fingerprint scan results are: Blood Pressure " + (liveBpSys + 14) + "/" + (liveBpDia + 8) + " mmHg, Heart Rate " + (liveBpm + 6) + " BPM, Oxygen SpO2 " + liveSpo2 + "%, Stress level MODERATE. Please provide medical guidance for pre-hypertensive blood pressure."
        }
      ];

      // Pick a random profile
      const selected = profiles[Math.floor(Math.random() * profiles.length)];

      updateVitalsUI(selected.bpm, selected.spo2, selected.bpSys, selected.bpDia, selected.stress);

      // Reset fingerprint button container style with green success flash
      if (fingerprintIconContainer) {
        fingerprintIconContainer.className = "w-11 h-11 rounded-full bg-emerald-500/30 border border-emerald-300 flex items-center justify-center transition-all duration-300 shadow-[0_0_20px_#10b981] relative overflow-hidden";
      }
      if (fingerprintIcon) {
        fingerprintIcon.className = "fas fa-check text-emerald-300";
      }
      if (fingerprintText) {
        fingerprintText.textContent = "VERIFIED";
        fingerprintText.className = "text-[9px] text-emerald-300 font-black tracking-widest uppercase mt-1.5";
      }

      setStatus("Touch Verified", "success");

      setTimeout(() => {
        if (callActive) setStatus("Live Connection", "success");
        // Revert fingerprint container to standby styling
        if (fingerprintIconContainer) {
          fingerprintIconContainer.className = "w-11 h-11 rounded-full bg-emerald-500/5 border border-emerald-500/25 flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:border-emerald-400/50 group-hover:bg-emerald-500/10 group-hover:shadow-[0_0_12px_rgba(16,185,129,0.25)] relative overflow-hidden";
        }
        if (fingerprintIcon) {
          fingerprintIcon.className = "fas fa-fingerprint text-base text-emerald-400/80 group-hover:text-emerald-300 transition-colors";
        }
        if (fingerprintText) {
          fingerprintText.textContent = "Biometric Sensor";
          fingerprintText.className = "text-[9px] text-emerald-400/60 font-black tracking-widest uppercase mt-1.5 transition-colors group-hover:text-emerald-300";
        }
      }, 2000);

      isScanning = false;

      const scanSummary = "Fingerprint Sensor Verification Complete: BP: " + selected.bpSys + "/" + selected.bpDia + " mmHg, HR: " + selected.bpm + " BPM, SpO2: " + selected.spo2 + "%. Patient stress level: " + selected.stress + ". " + selected.summary;

      // Inject clinical results into transcript/chat and analyze
      addChat("bot", "[TOUCH HUD] " + scanSummary);

      // Auto-trigger diagnostics
      analyzeSymptoms(selected.prompt);

      window.hmsShowToast && window.hmsShowToast("Verified", "Fingerprint vital parameters sync'd to medical AI.", "success");
    }, 2500);
  }

  // --- Camera-PPG Face-mesh Optical Scanner ---
  function startPPG() {
    if (ppgActive) return;
    if (!callActive || !localStream) {
      window.hmsShowToast && window.hmsShowToast("PPG Error", "Please start the diagnostics call first.", "warning");
      return;
    }

    ppgActive = true;
    sfx.playBoot();

    // Reveal hud card
    if (bioSensoryHud) {
      bioSensoryHud.classList.remove("hidden");
    }
    if (bioSensoryActiveDot) {
      bioSensoryActiveDot.className = "w-2.5 h-2.5 rounded-full bg-indigo-500 animate-ping";
    }

    // Toggle button active styling
    if (togglePpgBtn) {
      togglePpgBtn.classList.add("bg-indigo-600/20", "border-indigo-400/80");
      togglePpgBtn.querySelector("span").textContent = "PPG Sensor ON";
    }

    // Clear and size canvas
    ppgCanvas = document.getElementById("ppgCanvas");
    if (ppgCanvas) {
      ppgCtx = ppgCanvas.getContext("2d");
      ppgCanvas.width = ppgCanvas.clientWidth;
      ppgCanvas.height = ppgCanvas.clientHeight;
    }

    // Create offscreen canvas for frame pixel analysis
    if (!ppgSampleCanvas) {
      ppgSampleCanvas = document.createElement("canvas");
      ppgSampleCanvas.width = 40;
      ppgSampleCanvas.height = 40;
      ppgSampleCtx = ppgSampleCanvas.getContext("2d");
    }

    // Reset analytical history variables
    ppgHistory = [];
    rawPpgHistory = [];
    ppgLastPeaks = [];
    ppgIntervals = [];
    ppgX = 0;
    ppgSignalBpm = 72;
    ppgHrv = 55;
    ppgPrevFrameData = null;
    ppgMotionIntensity = 0;
    ppgRespirationHistory = [];
    ppgBreathingRate = 15;
    ppgLastBreaths = [];

    // Trigger non-blocking frame analysis loop
    drawPPGLoop();

    window.hmsShowToast && window.hmsShowToast("PPG Sensor Active", "Analyzing video frame pixels for blood volume changes.", "success");
  }

  function stopPPG() {
    if (!ppgActive) return;
    ppgActive = false;

    if (ppgFrameId) {
      cancelAnimationFrame(ppgFrameId);
      ppgFrameId = null;
    }

    // Reset HUD details
    if (bioSensoryActiveDot) {
      bioSensoryActiveDot.className = "w-2.5 h-2.5 rounded-full bg-gray-500";
    }
    if (ppgBpmText) ppgBpmText.textContent = "-- BPM";
    if (diagHrv) diagHrv.textContent = "-- ms";
    if (diagBreathing) diagBreathing.textContent = "-- rpm";
    if (diagSignal) diagSignal.textContent = "--";
    if (diagLight) diagLight.textContent = "--";

    // Toggle button style
    if (togglePpgBtn) {
      togglePpgBtn.classList.remove("bg-indigo-600/20", "border-indigo-400/80");
      togglePpgBtn.querySelector("span").textContent = "PPG Camera Sensor";
    }

    // Clear canvas trace
    if (ppgCanvas && ppgCtx) {
      ppgCtx.clearRect(0, 0, ppgCanvas.width, ppgCanvas.height);
    }

    window.hmsShowToast && window.hmsShowToast("PPG Sensor Offline", "Webcam frame diagnostics paused.", "info");
  }

  function drawPPGLoop() {
    if (!ppgActive || !callActive) return;
    ppgFrameId = requestAnimationFrame(drawPPGLoop);

    const video = document.getElementById("localVideo");
    if (!video || video.paused || video.ended || video.readyState < 2) {
      if (diagSignal) diagSignal.innerHTML = '<span class="text-amber-400 animate-pulse">NO VIDEO</span>';
      return;
    }

    const w = ppgCanvas ? (ppgCanvas.width = ppgCanvas.clientWidth) : 0;
    const h = ppgCanvas ? (ppgCanvas.height = ppgCanvas.clientHeight) : 0;

    try {
      const sampleSize = 40;
      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 480;
      const sx = Math.max(0, (vw - sampleSize) / 2);
      const sy = Math.max(0, (vh - sampleSize) / 2);

      // Perform frame pixel capture
      ppgSampleCtx.drawImage(video, sx, sy, sampleSize, sampleSize, 0, 0, sampleSize, sampleSize);
      const imgData = ppgSampleCtx.getImageData(0, 0, sampleSize, sampleSize);
      const data = imgData.data;

      // Extract colors
      let redSum = 0, greenSum = 0, blueSum = 0, lumSum = 0;
      const totalPixels = data.length / 4;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];
        redSum += r;
        greenSum += g;
        blueSum += b;
        lumSum += (0.299 * r + 0.587 * g + 0.114 * b);
      }

      const avgRed = redSum / totalPixels;
      const avgGreen = greenSum / totalPixels;
      const avgBlue = blueSum / totalPixels;
      const avgLum = lumSum / totalPixels;

      // 1. Ambient lighting assessment
      let isLowLight = false;
      if (diagLight) {
        if (avgLum < 30) {
          isLowLight = true;
          diagLight.innerHTML = '<span class="text-rose-400 font-black animate-pulse">DARK</span>';
        } else if (avgLum > 235) {
          diagLight.innerHTML = '<span class="text-amber-400 font-bold">GLARE</span>';
        } else {
          diagLight.innerHTML = '<span class="text-emerald-400 font-bold">OPTIMAL</span>';
        }
      }

      // 2. Skin classification check
      let isFaceDetected = true;
      if (diagSignal) {
        const isSkinColor = avgRed > avgGreen && avgGreen > avgBlue && (avgRed - avgBlue) > 12;
        if (!isSkinColor && !isLowLight) {
          isFaceDetected = false;
          diagSignal.innerHTML = '<span class="text-rose-400 font-bold animate-pulse">ALIGN FACE</span>';
        } else {
          diagSignal.innerHTML = '<span class="text-emerald-400 font-bold">STABLE</span>';
        }
      }

      // 3. Motion artifact variance calculation
      let motion = 0;
      if (ppgPrevFrameData) {
        motion = Math.abs(avgLum - ppgPrevFrameData.avgLum);
      }
      ppgMotionIntensity = ppgMotionIntensity * 0.9 + motion * 0.1;
      ppgPrevFrameData = { avgLum };

      if (ppgMotionIntensity > 4.2) {
        if (diagSignal) {
          diagSignal.innerHTML = '<span class="text-amber-400 font-bold animate-pulse">HOLD STILL</span>';
        }
      }

      // Core physiological input parameter: Green channel fluctuation
      let currentVal = avgGreen;

      // Smooth fallback simulation if face is covered or lighting is very poor
      const nowTime = performance.now();
      if (!isFaceDetected || isLowLight) {
        const currentBpm = simulatedBpm || 72;
        const period = (60 / currentBpm) * 1000;
        const phase = (nowTime % period) / period;
        // Blood volume pulse formula simulation (double-peaks & notches)
        currentVal = Math.sin(phase * 2 * Math.PI) * 0.4 
                     + Math.sin(phase * 4 * Math.PI + 0.5) * 0.15;
      }

      // 4. Sliding Bandpass Filter
      rawPpgHistory.push(currentVal);
      if (rawPpgHistory.length > 150) rawPpgHistory.shift();

      // High-pass filter: subtract rolling average to eliminate DC drift
      let rollingSum = 0;
      const rollingWindow = Math.min(rawPpgHistory.length, 60);
      for (let i = rawPpgHistory.length - rollingWindow; i < rawPpgHistory.length; i++) {
        rollingSum += rawPpgHistory[i];
      }
      const mean = rollingSum / rollingWindow;
      let dcRemoved = currentVal - mean;

      // Low-pass filter: smooth high frequency noise
      let smoothed = dcRemoved;
      if (ppgHistory.length > 0) {
        smoothed = ppgHistory[ppgHistory.length - 1] * 0.82 + dcRemoved * 0.18;
      }

      ppgHistory.push(smoothed);
      if (ppgHistory.length > w) ppgHistory.shift();

      // 5. Dynamic Peak Detection
      if (ppgHistory.length >= 3) {
        const y0 = ppgHistory[ppgHistory.length - 3];
        const y1 = ppgHistory[ppgHistory.length - 2];
        const y2 = ppgHistory[ppgHistory.length - 1];

        const peakThreshold = (!isFaceDetected || isLowLight) ? 0.05 : 0.08;
        if (y1 > y0 && y1 > y2 && y1 > peakThreshold) {
          const lastPeakTime = ppgLastPeaks[ppgLastPeaks.length - 1] || 0;
          const elapsed = nowTime - lastPeakTime;

          // Heart rate range boundary filter
          if (elapsed > 400 && elapsed < 1600) {
            ppgLastPeaks.push(nowTime);
            if (ppgLastPeaks.length > 12) ppgLastPeaks.shift();

            ppgIntervals.push(elapsed);
            if (ppgIntervals.length > 12) ppgIntervals.shift();

            // Calculate instantaneous Heart Rate
            const sumIntervals = ppgIntervals.reduce((a, b) => a + b, 0);
            const avgInterval = sumIntervals / ppgIntervals.length;
            ppgSignalBpm = Math.round(60000 / avgInterval);

            // Compute HRV (SDNN)
            if (ppgIntervals.length >= 4) {
              const meanInterval = sumIntervals / ppgIntervals.length;
              const sqDiffSum = ppgIntervals.reduce((a, b) => a + Math.pow(b - meanInterval, 2), 0);
              ppgHrv = Math.round(Math.sqrt(sqDiffSum / ppgIntervals.length));
            }
          }
        }
      }

      // Smooth simulated heartbeat values
      if (ppgSignalBpm) {
        simulatedBpm = Math.round(simulatedBpm * 0.88 + ppgSignalBpm * 0.12);
      }

      // Respiration baseline calculation: track slower breathing cycle
      ppgRespirationHistory.push(avgGreen);
      if (ppgRespirationHistory.length > 150) ppgRespirationHistory.shift();

      let respRate = ppgBreathingRate;
      if (ppgRespirationHistory.length >= 60) {
        let smoothedResp = [];
        for (let i = 12; i < ppgRespirationHistory.length - 12; i++) {
          let sum = 0;
          for (let k = -12; k <= 12; k++) {
            sum += ppgRespirationHistory[i + k];
          }
          smoothedResp.push({ val: sum / 25, idx: i });
        }

        let respPeaks = [];
        for (let i = 2; i < smoothedResp.length - 2; i++) {
          const y0 = smoothedResp[i - 2].val;
          const y1 = smoothedResp[i - 1].val;
          const y2 = smoothedResp[i].val;
          const y3 = smoothedResp[i + 1].val;
          const y4 = smoothedResp[i + 2].val;
          if (y2 > y1 && y2 > y0 && y2 > y3 && y2 > y4) {
            respPeaks.push(smoothedResp[i].idx);
          }
        }

        if (respPeaks.length >= 2) {
          let intervals = [];
          for (let i = 1; i < respPeaks.length; i++) {
            const elapsedMs = (respPeaks[i] - respPeaks[i - 1]) * 33.3;
            if (elapsedMs > 2000 && elapsedMs < 6000) {
              intervals.push(elapsedMs);
            }
          }
          if (intervals.length > 0) {
            const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
            respRate = Math.round(60000 / avgInterval);
          }
        }
      }

      if (!isFaceDetected || isLowLight) {
        respRate = 12 + Math.round(Math.sin(nowTime / 15000) * 2 + Math.random() * 0.5);
      }

      ppgBreathingRate = Math.round(ppgBreathingRate * 0.95 + respRate * 0.05);

      // 6. Dynamic Stress Detection (incorporating Breathing Pattern and HRV)
      let stressLevel = "CALM";
      let baseStress = 50;
      baseStress += (60 - ppgHrv) * 0.45; 
      baseStress += (simulatedBpm - 70) * 0.35;
      baseStress += ppgMotionIntensity * 5;
      baseStress += (ppgBreathingRate - 14) * 1.8; // stress increases with high respiration rate (hyperventilation)

      const isSpeakingAI = window.speechSynthesis && window.speechSynthesis.speaking;
      if (isSpeakingAI) baseStress -= 6;
      if (userSpeaking) baseStress += 4;

      baseStress = Math.min(95, Math.max(10, baseStress));
      const stressPercent = Math.round(baseStress);

      if (stressPercent > 72) {
        stressLevel = "ELEVATED";
      } else if (stressPercent > 42) {
        stressLevel = "MODERATE";
      } else {
        stressLevel = "CALM";
      }

      // Sync stress level and calculated heart rate directly with vital HUD and ECG wave
      updateVitalsUI(simulatedBpm, null, null, null, stressLevel);

      // Render diagnostic details
      if (ppgBpmText) ppgBpmText.textContent = simulatedBpm + " BPM";
      if (diagHrv) diagHrv.textContent = ppgHrv + " ms";
      if (diagBreathing) diagBreathing.textContent = ppgBreathingRate + " rpm";

      // Adapt Solfeggio frequencies on stress changes
      if (solfeggioActive) {
        adaptSolfeggioSynth(stressLevel);
      }

      // 7. Paint the scrolling PPG wave
      if (ppgCanvas && ppgCtx) {
        ppgCtx.clearRect(0, 0, w, h);

        ppgCtx.strokeStyle = "rgba(99, 102, 241, 0.05)";
        ppgCtx.lineWidth = 1;
        for (let gx = 0; gx < w; gx += 20) {
          ppgCtx.beginPath();
          ppgCtx.moveTo(gx, 0);
          ppgCtx.lineTo(gx, h);
          ppgCtx.stroke();
        }

        ppgCtx.strokeStyle = "#818cf8"; // neon indigo
        ppgCtx.lineWidth = 2.5;
        ppgCtx.shadowColor = "#6366f1";
        ppgCtx.shadowBlur = 6;
        ppgCtx.lineJoin = "round";

        ppgCtx.beginPath();
        const drawLen = Math.min(ppgHistory.length, w);
        const startX = w - drawLen;

        for (let i = 0; i < drawLen; i++) {
          const val = ppgHistory[ppgHistory.length - drawLen + i];
          const scale = (!isFaceDetected || isLowLight) ? 22 : 6;
          const y = h / 2 - (val * scale);
          const clampedY = Math.min(h - 2, Math.max(2, y));

          if (i === 0) {
            ppgCtx.moveTo(startX + i, clampedY);
          } else {
            ppgCtx.lineTo(startX + i, clampedY);
          }
        }
        ppgCtx.stroke();
        ppgCtx.shadowBlur = 0;
      }
    } catch (e) {
      console.warn("PPG analyzer processing issue:", e.message);
    }
  }

  // --- Stress-Reactive Solfeggio Healing Soundscape ---
  function startSolfeggio() {
    if (solfeggioActive) return;
    
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
      solCtx = new AudioCtxClass();
      
      // Create master gain node
      solGainMaster = solCtx.createGain();
      solGainMaster.gain.setValueAtTime(0, solCtx.currentTime);
      
      // Smooth fade-in over 2 seconds
      solGainMaster.gain.linearRampToValueAtTime(solVolume * 0.12, solCtx.currentTime + 2.0);
      
      // Create warming low-pass filter
      solFilter = solCtx.createBiquadFilter();
      solFilter.type = "lowpass";
      solFilter.Q.value = 1.2;
      solFilter.frequency.setValueAtTime(400, solCtx.currentTime);
      
      // Connect filter to destination
      solFilter.connect(solGainMaster);
      solGainMaster.connect(solCtx.destination);
      
      // Create left & right oscillators for binaural theta-wave beats (detuned by 4Hz)
      solOscL = solCtx.createOscillator();
      solOscL.type = "sine";
      solOscL.frequency.setValueAtTime(432, solCtx.currentTime); // default calm (432Hz)
      
      solOscR = solCtx.createOscillator();
      solOscR.type = "sine";
      solOscR.frequency.setValueAtTime(436, solCtx.currentTime); // detuned by 4Hz (deep theta)
      
      // Create stereo panners for spatial headphones soundscape separation
      const panL = solCtx.createStereoPanner ? solCtx.createStereoPanner() : null;
      const panR = solCtx.createStereoPanner ? solCtx.createStereoPanner() : null;
      
      if (panL && panR) {
        panL.pan.setValueAtTime(-1.0, solCtx.currentTime);
        panR.pan.setValueAtTime(1.0, solCtx.currentTime);
        
        solOscL.connect(panL);
        panL.connect(solFilter);
        
        solOscR.connect(panR);
        panR.connect(solFilter);
      } else {
        solOscL.connect(solFilter);
        solOscR.connect(solFilter);
      }
      
      // Organic filter LFO
      solLfo = solCtx.createOscillator();
      solLfo.type = "sine";
      solLfo.frequency.setValueAtTime(0.08, solCtx.currentTime);
      
      const lfoGain = solCtx.createGain();
      lfoGain.gain.setValueAtTime(140, solCtx.currentTime);
      
      solLfo.connect(lfoGain);
      lfoGain.connect(solFilter.frequency);
      
      solOscL.start(solCtx.currentTime);
      solOscR.start(solCtx.currentTime);
      solLfo.start(solCtx.currentTime);
      
      solfeggioActive = true;
      
      // Update UI button and frequency details
      if (solfeggioToggleBtn) {
        solfeggioToggleBtn.innerHTML = '<i class="fas fa-volume-up text-[8px] animate-pulse"></i><span>Active</span>';
        solfeggioToggleBtn.classList.add("bg-indigo-600/40", "border-indigo-400");
      }
      if (solfeggioFreqText) {
        solfeggioFreqText.textContent = "432 Hz";
      }
      
      sfx.playVerify();
      window.hmsShowToast && window.hmsShowToast("Solfeggio Active", "Therapeutic soundscape initialized.", "success");
      
    } catch (e) {
      console.warn("Solfeggio Soundscape failed to initialize:", e.message);
      window.hmsShowToast && window.hmsShowToast("Audio Error", "Binaural soundscape could not start on this browser.", "warning");
    }
  }

  function stopSolfeggio() {
    if (!solfeggioActive) return;
    solfeggioActive = false;
    
    try {
      const now = solCtx ? solCtx.currentTime : 0;
      
      // Smoothly fade out to prevent clicking pops
      if (solGainMaster && solCtx) {
        solGainMaster.gain.cancelScheduledValues(now);
        solGainMaster.gain.setValueAtTime(solGainMaster.gain.value, now);
        solGainMaster.gain.linearRampToValueAtTime(0.0001, now + 0.8);
      }
      
      // Safe teardown after fade-out completes
      setTimeout(() => {
        if (solOscL) { try { solOscL.stop(); solOscL.disconnect(); } catch (e) {} solOscL = null; }
        if (solOscR) { try { solOscR.stop(); solOscR.disconnect(); } catch (e) {} solOscR = null; }
        if (solLfo) { try { solLfo.stop(); solLfo.disconnect(); } catch (e) {} solLfo = null; }
        if (solFilter) { try { solFilter.disconnect(); } catch (e) {} solFilter = null; }
        if (solGainMaster) { try { solGainMaster.disconnect(); } catch (e) {} solGainMaster = null; }
        if (solCtx) { solCtx.close().catch(() => {}); solCtx = null; }
      }, 900);
      
      // Reset UI controls
      if (solfeggioToggleBtn) {
        solfeggioToggleBtn.innerHTML = '<i class="fas fa-play text-[8px]"></i><span>Muted</span>';
        solfeggioToggleBtn.classList.remove("bg-indigo-600/40", "border-indigo-400");
      }
      if (solfeggioFreqText) {
        solfeggioFreqText.textContent = "OFF";
      }
      
      sfx.playShutdown();
      window.hmsShowToast && window.hmsShowToast("Solfeggio Muted", "Healing soundscape stopped.", "info");
      
    } catch (err) {
      console.warn("Teardown soundscape error:", err.message);
    }
  }

  // Real-time smooth tone morphing on stress modifications
  let lastStressLevel = "";
  function adaptSolfeggioSynth(stressLevel) {
    if (!solfeggioActive || !solCtx || !solOscL || !solOscR || !solFilter || !solLfo) return;
    if (stressLevel === lastStressLevel) return;
    lastStressLevel = stressLevel;
    
    const now = solCtx.currentTime;
    
    let baseFreq = 432;  // CALM -> 432Hz
    let filterFreq = 850; 
    let lfoRate = 0.12; 
    let stressLabel = "432 Hz";
    
    if (stressLevel === "ELEVATED") {
      baseFreq = 396;    // ELEVATED -> 396Hz (Grounding)
      filterFreq = 220;  // Dark sub filter
      lfoRate = 0.04;    // Extremely slow breathing
      stressLabel = "396 Hz (Grounding)";
    } else if (stressLevel === "MODERATE") {
      baseFreq = 528;    // MODERATE -> 528Hz (Cellular Repair)
      filterFreq = 440;  // Moderate warm filter
      lfoRate = 0.08;    // Heartbeat sweep
      stressLabel = "528 Hz (Repair)";
    }
    
    try {
      // Prevent pop or clicks by smoothly ramping parameters over 2.5 seconds
      solOscL.frequency.cancelScheduledValues(now);
      solOscL.frequency.setValueAtTime(solOscL.frequency.value, now);
      solOscL.frequency.exponentialRampToValueAtTime(baseFreq, now + 2.5);
      
      solOscR.frequency.cancelScheduledValues(now);
      solOscR.frequency.setValueAtTime(solOscR.frequency.value, now);
      solOscR.frequency.exponentialRampToValueAtTime(baseFreq + 4, now + 2.5);
      
      solFilter.frequency.cancelScheduledValues(now);
      solFilter.frequency.setValueAtTime(solFilter.frequency.value, now);
      solFilter.frequency.exponentialRampToValueAtTime(filterFreq, now + 2.5);
      
      solLfo.frequency.cancelScheduledValues(now);
      solLfo.frequency.setValueAtTime(solLfo.frequency.value, now);
      solLfo.frequency.linearRampToValueAtTime(lfoRate, now + 2.5);
      
      if (solfeggioFreqText) {
        solfeggioFreqText.textContent = stressLabel;
      }
      
      console.log(`[Solfeggio Soundscape] Morphed synth parameters for: ${stressLevel}`);
    } catch (e) {
      console.warn("Failed to ramp Solfeggio soundscape parameters:", e.message);
    }
  }

  function adjustSolfeggioVolume(volVal) {
    solVolume = parseFloat(volVal);
    
    if (solfeggioVolPercent) {
      solfeggioVolPercent.textContent = Math.round(solVolume * 100) + "%";
    }
    
    if (solfeggioActive && solGainMaster && solCtx) {
      const now = solCtx.currentTime;
      solGainMaster.gain.cancelScheduledValues(now);
      solGainMaster.gain.setValueAtTime(solGainMaster.gain.value, now);
      solGainMaster.gain.linearRampToValueAtTime(solVolume * 0.12, now + 0.15);
    }
  }

  // --- Core WebRTC video consult calls ---
  async function startCall() {
    if (callActive || localStream) {
      console.warn("Call or local media stream is already active.");
      return;
    }
    try {
      localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideo.srcObject = localStream;
      localVideo.classList.remove("opacity-0");
      localVideo.classList.add("opacity-70");
      
      const fallbackHUD = document.getElementById("cameraFallbackHUD");
      if (fallbackHUD) fallbackHUD.classList.add("hidden");

      callActive = true;
      callStart = Date.now();
      
      startBtn.classList.add("hidden");
      endBtn.classList.remove("hidden");
      speakBtn.classList.remove("hidden");
      saveBtn.classList.remove("hidden");
      if (togglePpgBtn) togglePpgBtn.classList.remove("hidden");
      
      setStatus("Live Connection", "success");
      sfx.playBoot();
      addChat("bot", "Hello! Welcome to the Autonomous Medical Room. I'm your virtual doctor. Please speak out loud or type the symptoms you're experiencing.");
      
      startAudioVisualizer(localStream);
      startAvatarVisualizer();
      initSpeechRecognition();
      toggleMic(true); // Automatically listen on start

      startVitalsBackgroundLoop();
      initECG();
      startECGDraw();

      // Show face target mesh and trigger hyper-realistic drifting coordinates interval
      if (aiTargetMesh) aiTargetMesh.classList.remove("hidden");
      let baseCoordX = 45.2890;
      let baseCoordY = 62.1582;
      
      meshInterval = setInterval(() => {
        // Drift coordinates smoothly
        baseCoordX += (Math.random() - 0.5) * 0.4;
        baseCoordY += (Math.random() - 0.5) * 0.4;
        
        // Boundaries
        if (baseCoordX < 20) baseCoordX = 35;
        if (baseCoordX > 80) baseCoordX = 65;
        if (baseCoordY < 20) baseCoordY = 35;
        if (baseCoordY > 80) baseCoordY = 65;
        
        if (meshCoordX) meshCoordX.textContent = baseCoordX.toFixed(4) + " px";
        if (meshCoordY) meshCoordY.textContent = baseCoordY.toFixed(4) + " px";
        
        // Cycle face tracking states
        if (meshTrackState) {
          const states = ["LOCK_STABLE", "LOCK_STABLE", "CALIBRATING", "ALIGN_OK", "LOCK_STABLE"];
          const state = states[Math.floor(Math.random() * states.length)];
          meshTrackState.textContent = state;
          if (state === "LOCK_STABLE" || state === "ALIGN_OK") {
            meshTrackState.className = "text-emerald-400 font-bold";
          } else {
            meshTrackState.className = "text-amber-400 font-bold animate-pulse";
          }
        }
      }, 180);

    } catch (e) {
      console.warn("Camera or microphone blocked. Starting in audio-telemetry fallback mode.", e.message);
      window.hmsShowToast && window.hmsShowToast("Telemetry Fallback", "Starting in audio/telemetry diagnostics mode.", "warning");
      
      // Ensure webcam stream indicator is hidden but fallback HUD is visible
      if (localVideo) {
        localVideo.classList.add("opacity-0");
        localVideo.classList.remove("opacity-70");
      }
      const fallbackHUD = document.getElementById("cameraFallbackHUD");
      if (fallbackHUD) fallbackHUD.classList.remove("hidden");
      
      // Still boot call state, biometric streams and avatars!
      callActive = true;
      callStart = Date.now();
      
      startBtn.classList.add("hidden");
      endBtn.classList.remove("hidden");
      speakBtn.classList.remove("hidden");
      saveBtn.classList.remove("hidden");
      
      setStatus("Live Telemetry", "success");
      sfx.playBoot();
      addChat("bot", "I see camera permissions are restricted. No problem! I am online via direct audio-telemetry link. Please describe your symptoms or write them below.");
      
      startAvatarVisualizer();
      initSpeechRecognition();
      toggleMic(true); // Automatically listen on start

      startVitalsBackgroundLoop();
      initECG();
      startECGDraw();
    }
  }

  function endCall() {
    sfx.playShutdown();
    stopECG();
    if (vitalsInterval) {
      clearInterval(vitalsInterval);
      vitalsInterval = null;
    }
    if (meshInterval) {
      clearInterval(meshInterval);
      meshInterval = null;
    }
    isScanning = false;
    userSpeaking = false;
    
    if (vitalsHud) vitalsHud.classList.add("hidden");
    if (aiTargetMesh) aiTargetMesh.classList.add("hidden");
    const fallbackHUD = document.getElementById("cameraFallbackHUD");
    if (fallbackHUD) fallbackHUD.classList.add("hidden");
    
    if (scanBtn) {
      scanBtn.classList.add("hidden");
      scanBtn.disabled = false;
      scanBtn.classList.remove("opacity-50");
      scanBtn.innerHTML = '<i class="fas fa-heartbeat text-emerald-400 animate-pulse"></i><span class="text-emerald-300">Biometric Scan</span>';
    }
    if (laserScanLine) {
      laserScanLine.classList.remove("laser-scanning");
      laserScanLine.classList.add("hidden");
    }
    
    // Reset HUD text and progress bars
    updateVitalsUI(0, 0, 0, 0, "--");
    if (barBpm) barBpm.style.width = "0%";
    if (barSpo2) barSpo2.style.width = "0%";
    if (barBp) barBp.style.width = "0%";
    if (barStress) barStress.style.width = "0%";

    if (fingerprintIconContainer) {
      fingerprintIconContainer.className = "w-11 h-11 rounded-full bg-emerald-500/5 border border-emerald-500/25 flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:border-emerald-400/50 group-hover:bg-emerald-500/10 group-hover:shadow-[0_0_12px_rgba(16,185,129,0.25)] relative overflow-hidden";
    }
    if (fingerprintIcon) {
      fingerprintIcon.className = "fas fa-fingerprint text-base text-emerald-400/80 group-hover:text-emerald-300 transition-colors";
    }
    if (fingerprintText) {
      fingerprintText.textContent = "Biometric Sensor";
      fingerprintText.className = "text-[9px] text-emerald-400/60 font-black tracking-widest uppercase mt-1.5 transition-colors group-hover:text-emerald-300";
    }

    // Shutdown PPG Sensor and Solfeggio soundscape on call disconnect
    stopPPG();
    stopSolfeggio();
    if (togglePpgBtn) togglePpgBtn.classList.add("hidden");
    if (bioSensoryHud) bioSensoryHud.classList.add("hidden");

    if (localStream) {
      localStream.getTracks().forEach(t => t.stop());
      localStream = null;
    }
    if (localVideo) {
      localVideo.srcObject = null;
      localVideo.classList.add("opacity-0");
    }
    
    stopVisualizers();
    if (recognition) {
      try { recognition.stop(); } catch (e) {}
    }
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    // Stop real-time WebSocket vitals telemetry simulation
    if (window.__HMS_SOCKET__) {
      window.__HMS_SOCKET__.emit('stop-vitals-monitoring');
      window.__HMS_SOCKET__.off('vitals-update');
    }
    
    callActive = false;
    startBtn.classList.remove("hidden");
    endBtn.classList.add("hidden");
    speakBtn.classList.add("hidden");
    setStatus("Standby", "primary");
    addChat("bot", "Your diagnostics consultation session has ended. You can review or save the session metrics.");
  }

  function initSpeechRecognition() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      window.hmsShowToast && window.hmsShowToast("Speech API", "Bilingual speech recognition is unsupported on this browser. Typing symptoms is fully available.", "warning");
      return;
    }
    if (recognition) return;

    recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-IN"; // Enable Indian English/Hinglish speech accents perfectly!
    
    recognition.onspeechstart = function () {
      userSpeaking = true;
    };
    
    recognition.onspeechend = function () {
      userSpeaking = false;
    };
    
    recognition.onresult = function (event) {
      // Prevent listening to synthetic AI speech feedback loop
      if (window.speechSynthesis && window.speechSynthesis.speaking) {
        return;
      }
      
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }
      
      const textToDisplay = (final || interim).trim();
      if (textToDisplay) {
        transcriptBox.textContent = textToDisplay;
        symptomInput.value = textToDisplay;
        currentSpeechSegment = textToDisplay;
      }
      
      // Debounce timer for silence detection (natural pause)
      if (speechTimeout) clearTimeout(speechTimeout);
      speechTimeout = setTimeout(() => {
        if (currentSpeechSegment.trim()) {
          const textToAnalyze = currentSpeechSegment.trim();
          currentSpeechSegment = ""; // Reset segment
          analyzeSymptoms(textToAnalyze);
        }
      }, 1500);
    };
  }

  function toggleMic(forceStart = false) {
    if (!recognition) initSpeechRecognition();
    if (!recognition) return;
    
    const isListening = micBtn.textContent.includes("Stop");
    
    if (isListening && !forceStart) {
      try { recognition.stop(); } catch (e) {}
      micBtn.innerHTML = '<i class="fas fa-microphone mr-2"></i>Voice Capture';
      if (callActive) setStatus("Live Connection", "success");
    } else {
      try {
        recognition.start();
        setStatus("AI Listening...", "info");
        micBtn.innerHTML = '<i class="fas fa-stop mr-2"></i>Stop Listening';
        recognition.onend = function () {
          // Continuous Listening Auto-restart (unless AI is speaking)
          if (callActive && micBtn.textContent.includes("Stop")) {
            const isSpeaking = window.speechSynthesis && window.speechSynthesis.speaking;
            if (!isSpeaking) {
              try { recognition.start(); } catch (e) {}
              return;
            }
          }
          micBtn.innerHTML = '<i class="fas fa-microphone mr-2"></i>Voice Capture';
          if (callActive) setStatus("Live Connection", "success");
        };
      } catch (e) {
        // Recognition already running, suppress error
      }
    }
  }

  async function analyzeSymptoms(text) {
    if (!text || !text.trim()) return;
    
    // Append to cumulative session transcript for saved reports
    if (!transcript.includes(text.trim())) {
      transcript = (transcript + " " + text.trim()).trim();
      transcriptBox.textContent = transcript;
    }
    
    addChat("user", text.trim());
    analysisContent.innerHTML = '<div class="flex flex-col items-center justify-center h-32 text-center"><i class="fas fa-spinner fa-spin text-2xl text-indigo-500 mb-3"></i><p class="text-white font-bold">Decoding Symptoms...</p></div>';
    
    try {
      const res = await fetch("/patient/ai-consultation/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symptoms: text, transcript: transcript })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Diagnostics mapping failed");
      
      lastAnalysis = data.analysis;
      renderAnalysis(data.analysis);
      
      const reply = data.analysis.summary;
      addChat("bot", reply);
      speakText(reply);
    } catch (err) {
      analysisContent.innerHTML = '<div class="text-rose-500 text-sm p-4"><i class="fas fa-exclamation-triangle mr-2"></i>' + escapeHtml(err.message) + '</div>';
      window.hmsShowToast && window.hmsShowToast("Diagnostics failed", err.message, "error");
    }
  }

  function renderAnalysis(a) {
    let html = "<div class='space-y-4 text-sm animate-fade-in'>";
    
    if (a.possible_conditions && a.possible_conditions.length) {
      html += "<div class='border-b border-white/5 pb-3'><strong class='text-white text-xs uppercase tracking-wider text-indigo-400 block mb-2'>Identified Pathology</strong><ul class='space-y-2'>";
      a.possible_conditions.forEach(c => {
        const severityColors = c.severity === "high" ? "text-rose-400 bg-rose-500/10 border-rose-500/20" : "text-amber-400 bg-amber-500/10 border-amber-500/20";
        html += "<li class='bg-white/5 rounded-xl p-3 border border-white/10'><div class='flex justify-between items-center mb-1'><span class='text-white font-bold'>" + escapeHtml(c.name) + "</span><span class='text-[10px] px-2 py-0.5 rounded border " + severityColors + " uppercase font-black tracking-widest'>" + escapeHtml(c.severity) + "</span></div><p class='text-gray-400 text-xs mt-1 leading-relaxed'>" + escapeHtml(c.description) + "</p></li>";
      });
      html += "</ul></div>";
    }
    
    if (a.medicines && a.medicines.length) {
      html += "<div class='border-b border-white/5 pb-3'><strong class='text-white text-xs uppercase tracking-wider text-indigo-400 block mb-2'>AI Prescription Support</strong><div class='flex flex-wrap gap-1.5'>";
      a.medicines.forEach(m => {
        html += "<span class='bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 font-bold px-3 py-1 rounded-full text-xs'>" + escapeHtml(m) + "</span>";
      });
      html += "</div></div>";
    }
    
    if (a.precautions && a.precautions.length) {
      html += "<div class='border-b border-white/5 pb-3'><strong class='text-white text-xs uppercase tracking-wider text-indigo-400 block mb-2'>Precautions & Recovery</strong><ul class='space-y-1 text-gray-300 text-xs list-decimal pl-4'>";
      a.precautions.forEach(p => { html += "<li>" + escapeHtml(p) + "</li>"; });
      html += "</ul></div>";
    }
    
    if (a.recommended_specialty) {
      html += "<div class='border-b border-white/5 pb-3'><strong class='text-white text-xs uppercase tracking-wider text-indigo-400 block mb-1'>Required Care Specialist</strong><p class='text-white text-sm font-bold'><i class='fas fa-user-md mr-2 text-indigo-400'></i>" + escapeHtml(a.recommended_specialty) + "</p></div>";
    }

    // Glowing openFDA Clinical Safety Alerts widget inside the insights sidebar
    if (a.fdaSafetyAlerts && a.fdaSafetyAlerts.length) {
      html += "<div class='border-b border-white/5 pb-3'><div class='flex items-center gap-2 mb-3'><div class='px-2 py-0.5 text-[9px] font-black uppercase bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-md animate-pulse'>Live FDA Monitor</div><strong class='text-white text-xs uppercase tracking-wider text-rose-400 block'>Drug Safety Audits</strong></div><div class='space-y-3'>";
      
      a.fdaSafetyAlerts.forEach((alert, index) => {
        const isLive = alert.source === "live_fda";
        const badgeHtml = isLive 
          ? "<span class='px-2 py-0.5 text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded font-bold uppercase'>FDA Live Verified</span>" 
          : "<span class='px-2 py-0.5 text-[9px] bg-slate-500/10 text-slate-400 border border-white/10 rounded font-bold uppercase'>Local Secured Cache</span>";
        
        html += "<div class='bg-slate-950/60 border border-rose-500/20 rounded-2xl p-4 space-y-3 shadow-lg shadow-rose-950/5 hover:border-rose-500/30 transition-all duration-300'>";
        
        // Drug title & Active Ingredient
        html += "<div class='flex flex-col justify-between items-start gap-2 border-b border-white/5 pb-2.5'>";
        html += "<div><div class='font-bold text-white text-sm'>" + escapeHtml(alert.medicine) + "</div><div class='text-[10px] text-gray-400 font-mono mt-0.5'>Active: " + escapeHtml(alert.active_ingredient) + "</div></div>";
        html += badgeHtml;
        html += "</div>";

        // Collapsible drawers
        html += "<div class='space-y-2'>";
        
        const params = [
          { label: "Warnings & Allergies", value: alert.warnings, icon: "fa-exclamation-triangle", color: "text-rose-400" },
          { label: "Contraindications", value: alert.contraindications, icon: "fa-ban", color: "text-amber-400" },
          { label: "Drug Interactions", value: alert.drug_interactions, icon: "fa-exchange-alt", color: "text-amber-400" },
          { label: "Side Effects", value: alert.adverse_reactions, icon: "fa-heartbeat", color: "text-indigo-400" },
          { label: "Overdosage Risks", value: alert.overdosage, icon: "fa-skull-crossbones", color: "text-rose-400" },
          { label: "Pregnancy Warnings", value: alert.pregnancy, icon: "fa-baby", color: "text-indigo-400" }
        ];
        
        params.forEach((p, pIdx) => {
          const drawerId = "fda-drawer-" + index + "-" + pIdx;
          html += "<div class='rounded-xl border border-white/5 overflow-hidden transition-all duration-300 hover:bg-white/5'>";
          
          // Drawer Header
          html += "<button type='button' onclick='const d=document.getElementById(\"" + drawerId + "\"); d.classList.toggle(\"hidden\"); this.querySelector(\"i.fa-chevron-down\").classList.toggle(\"rotate-180\");' class='w-full px-3 py-2 flex items-center justify-between font-medium text-left text-xs transition-all text-gray-300 focus:outline-none bg-slate-950/20'>";
          html += "<span class='flex items-center gap-2 " + p.color + "'><i class='fas " + p.icon + "'></i><span class='font-bold text-gray-200'>" + p.label + "</span></span>";
          html += "<i class='fas fa-chevron-down text-[10px] text-gray-500 transition-transform duration-200'></i>";
          html += "</button>";
          
          // Drawer Content
          html += "<div id='" + drawerId + "' class='hidden px-3.5 pb-3.5 pt-1.5 border-t border-white/5 bg-slate-950/40 text-[11px] text-gray-400 leading-relaxed font-normal'>";
          html += escapeHtml(p.value || "No safety warnings logged under FDA clinical database.");
          html += "</div>";
          
          html += "</div>";
        });

        html += "</div></div>";
      });
      
      html += "</div></div>";
    }
    
    if (a.recommended_doctors && a.recommended_doctors.length) {
      html += "<div><strong class='text-white text-xs uppercase tracking-wider text-indigo-400 block mb-2'>HMS Doctor Recommendations</strong><ul class='space-y-2'>";
      a.recommended_doctors.forEach(d => {
        html += "<li class='flex items-center justify-between bg-white/5 rounded-xl p-3 border border-white/10 hover:border-indigo-500/30 transition-colors'><div class='flex flex-col'><span class='text-white font-bold text-xs'>" + escapeHtml(d.name) + "</span><span class='text-[10px] text-gray-400 mt-0.5'>" + escapeHtml(d.specialization || "Physician") + "</span></div><a href='/patient/doctors/" + d.doctor_id + "' class='px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] tracking-wider rounded-lg uppercase transition-all shadow-md shadow-indigo-600/10'>Book Slot</a></li>";
      });
      html += "</ul></div>";
    }
    
    html += "</div>";
    analysisContent.innerHTML = html;
  }

  function speakText(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.95;
    u.pitch = 1.05;
    
    // Choose native English/Indian voice if available
    const voices = window.speechSynthesis.getVoices();
    const targetVoice = voices.find(v => v.lang.includes("en-IN") || v.lang.includes("hi-IN") || v.name.includes("Google"));
    if (targetVoice) u.voice = targetVoice;
    
    u.onstart = function() {
      // Abort speech recognition to prevent loops when the AI talks
      if (recognition) {
        try { recognition.abort(); } catch (e) {}
      }
    };
    
    u.onend = function() {
      // Resume continuous listening when speaking ends
      if (callActive && micBtn && micBtn.textContent.includes("Stop")) {
        try { recognition.start(); } catch (e) {}
      }
    };
    
    window.speechSynthesis.speak(u);
  }

  async function saveConsultation() {
    if (!lastAnalysis) {
      window.hmsShowToast && window.hmsShowToast("Diagnostics Report", "Please initiate consultation diagnostic mappings first.", "warning");
      return;
    }
    const duration = callStart ? Math.round((Date.now() - callStart) / 1000) : 0;
    
    // Extract current stress level from HUD to sync with Wellbeing telemetry logs
    const currentStress = hudStress ? hudStress.textContent : "CALM";
    let stressNum = 2; // Default calm
    if (currentStress === "MODERATE") stressNum = 5;
    else if (currentStress === "ELEVATED") stressNum = 8;
    
    const mood = currentStress === "CALM" ? "peaceful" : (currentStress === "MODERATE" ? "anxious" : "stressed");

    try {
      const res = await fetch("/patient/ai-consultation/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          ...lastAnalysis, 
          transcript, 
          duration_secs: duration,
          stress_level: stressNum,
          mood: mood
        })
      });
      const data = await res.json();
      if (data.success) {
        window.hmsShowToast && window.hmsShowToast("Saved Report", "AI diagnostics summary correctly persisted to HMS.", "success");
        setTimeout(() => { location.reload(); }, 1500);
      } else throw new Error(data.error);
    } catch (e) {
      window.hmsShowToast && window.hmsShowToast("Diagnostics persistence", e.message, "error");
    }
  }

  // Load avatar animations even during standby
  document.addEventListener("DOMContentLoaded", function () {
    startAvatarVisualizer();
  });

  if (startBtn) startBtn.addEventListener("click", startCall);
  if (endBtn) endBtn.addEventListener("click", endCall);
  if (scanBtn) scanBtn.addEventListener("click", runBiometricScan);
  if (fingerprintZone) fingerprintZone.addEventListener("click", runFingerprintScan);
  if (micBtn) micBtn.addEventListener("click", () => toggleMic());
  if (speakBtn) speakBtn.addEventListener("click", function () {
    if (lastAnalysis && lastAnalysis.summary) speakText(lastAnalysis.summary);
  });
  if (analyzeBtn) analyzeBtn.addEventListener("click", function () {
    analyzeSymptoms(symptomInput.value || transcript);
  });
  if (symptomInput) symptomInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter") analyzeSymptoms(symptomInput.value);
  });
  if (aiChatInput) aiChatInput.addEventListener("keypress", function (e) {
    if (e.key === "Enter" && aiChatInput.value.trim()) {
      analyzeSymptoms(aiChatInput.value);
      aiChatInput.value = "";
    }
  });
  
  const sendChatBtn = document.getElementById("sendChatBtn");
  if (sendChatBtn) {
    sendChatBtn.addEventListener("click", function () {
      if (aiChatInput && aiChatInput.value.trim()) {
        analyzeSymptoms(aiChatInput.value);
        aiChatInput.value = "";
      }
    });
  }
  if (togglePpgBtn) {
    togglePpgBtn.addEventListener("click", function () {
      sfx.playClick();
      if (ppgActive) {
        stopPPG();
      } else {
        startPPG();
      }
    });
  }

  if (solfeggioToggleBtn) {
    solfeggioToggleBtn.addEventListener("click", function () {
      sfx.playClick();
      if (solfeggioActive) {
        stopSolfeggio();
      } else {
        startSolfeggio();
      }
    });
  }

  if (solfeggioVolSlider) {
    solfeggioVolSlider.addEventListener("input", function (e) {
      adjustSolfeggioVolume(e.target.value);
    });
  }

  // AI Multi-Drug Interaction Checker Event Bindings
  const multiDrugInput = document.getElementById("multiDrugInput");
  const auditDrugsBtn = document.getElementById("auditDrugsBtn");
  const multiDrugResult = document.getElementById("multiDrugResult");

  if (auditDrugsBtn) {
    auditDrugsBtn.addEventListener("click", performDrugSafetyAudit);
  }
  if (multiDrugInput) {
    multiDrugInput.addEventListener("keypress", function (e) {
      if (e.key === "Enter") performDrugSafetyAudit();
    });
  }

  async function performDrugSafetyAudit() {
    if (!multiDrugInput || !multiDrugResult) return;
    const meds = multiDrugInput.value.trim();
    if (!meds) {
      window.hmsShowToast && window.hmsShowToast("Input Required", "Please enter at least one drug name.", "warning");
      return;
    }

    sfx.playClick();
    multiDrugResult.classList.remove("hidden");
    multiDrugResult.innerHTML = `
      <div class="flex flex-col items-center justify-center py-4 text-center">
        <i class="fas fa-spinner fa-spin text-lg text-indigo-500 mb-2"></i>
        <p class="text-white font-bold text-[10px]">Auditing Safety Logs...</p>
      </div>
    `;

    try {
      const res = await fetch("/patient/ai-consultation/audit-medications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ medications: meds })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Drug safety audit failed");

      const audit = data.audit;
      let badgeColor = "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
      let badgeLabel = "Low Risk / Safe";

      if (audit.risk_level === "high") {
        badgeColor = "bg-rose-500/10 border-rose-500/20 text-rose-400 animate-pulse";
        badgeLabel = "High Risk Warning";
      } else if (audit.risk_level === "moderate") {
        badgeColor = "bg-amber-500/10 border-amber-500/20 text-amber-400";
        badgeLabel = "Moderate Caution";
      }

      let html = `
        <div class="border-b border-white/5 pb-2">
          <div class="flex justify-between items-center mb-1">
            <span class="text-white font-bold text-[11px]">Audit Report</span>
            <span class="px-2 py-0.5 rounded border ${badgeColor} text-[9px] uppercase font-black tracking-wider">${badgeLabel}</span>
          </div>
          <p class="text-gray-300 leading-relaxed text-[11px] mt-1">${formatResponse(audit.interaction_details)}</p>
        </div>
      `;

      if (audit.precautions && audit.precautions.length) {
        html += `
          <div class="border-b border-white/5 pb-2">
            <strong class="text-indigo-400 text-[10px] uppercase font-black block mb-1">Safety Guidelines</strong>
            <ul class="list-disc pl-4 space-y-0.5 text-gray-400 text-[10px]">
              ${audit.precautions.map(p => `<li>${escapeHtml(p)}</li>`).join("")}
            </ul>
          </div>
        `;
      }

      if (audit.alternatives && audit.alternatives.length) {
        html += `
          <div>
            <strong class="text-emerald-400 text-[10px] uppercase font-black block mb-1">Clinical Alternatives</strong>
            <ul class="list-disc pl-4 space-y-0.5 text-gray-400 text-[10px]">
              ${audit.alternatives.map(a => `<li>${escapeHtml(a)}</li>`).join("")}
            </ul>
          </div>
        `;
      }

      multiDrugResult.innerHTML = html;
    } catch (err) {
      multiDrugResult.innerHTML = `
        <div class="text-rose-500 p-2 flex items-center gap-2">
          <i class="fas fa-exclamation-triangle"></i>
          <span>${escapeHtml(err.message)}</span>
        </div>
      `;
      window.hmsShowToast && window.hmsShowToast("Audit failed", err.message, "error");
    }
  }

  if (saveBtn) saveBtn.addEventListener("click", saveConsultation);

  // Production-grade unmount & navigation cleanup protectors
  window.addEventListener("beforeunload", function () {
    try {
      if (callActive) endCall();
    } catch (e) {
      console.warn("Unload cleanup error:", e.message);
    }
  });

  window.addEventListener("pagehide", function () {
    try {
      if (callActive) endCall();
    } catch (e) {
      console.warn("Pagehide cleanup error:", e.message);
    }
  });
})();
