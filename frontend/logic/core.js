// --- Webcam Setup ---
let videoStream = null;

async function startWebcam() {
  console.log("[core] Starting webcam...");
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
    const video = document.getElementById("videoElement");
    video.srcObject = videoStream;

    document.getElementById("startWebcamBtn").disabled = true;
    document.getElementById("stopWebcamBtn").disabled = false;
  } catch (err) {
    console.error("[core] Webcam error:", err);
    alert("Failed to access webcam");
  }
}

function stopWebcam() {
  console.log("[core] Stopping webcam...");
  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }

  document.getElementById("startWebcamBtn").disabled = false;
  document.getElementById("stopWebcamBtn").disabled = true;
}

// --- Gemini LLM Call ---
async function callLLM(prompt) {
  console.log("[core] Calling Gemini LLM...");
  const response = await fetch("http://localhost:3000/api/generateContent", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt })
  });
  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// --- Prompt Construction ---
function buildPrompt(resume, jd, tech, beh, sit) {
  let prompt = `Generate interview questions for the following candidate.\n\n`;
  prompt += `Return exactly:\n- ${tech} Technical\n- ${beh} Behavioral\n- ${sit} Situational\n\n`;
  prompt += `Format:\n### Technical Questions\n1.\n### Behavioral Questions\n1.\n### Situational Questions\n1.\n\n`;
  prompt += `Resume:\n${resume}\n`;
  if (jd && jd.length > 50) prompt += `\nJob Description:\n${jd}`;
  return prompt;
}

// --- Parse LLM Response ---
function parseLLMResponse(raw) {
  const sections = raw.split(/###\s+/).filter(Boolean);
  return sections.map(section => {
    const [title, ...lines] = section.trim().split("\n");
    const questions = lines.map(l => l.replace(/^\d+[).]\s*/, "")).filter(q => q.length > 5);
    return { title: title.trim(), questions };
  });
}

// --- Render Questions to DOM ---
function renderQuestions(blocks) {
  const container = document.getElementById("questionsContainer");
  container.innerHTML = "";
  let count = 1;

  blocks.forEach(block => {
    const h3 = document.createElement("h3");
    h3.textContent = block.title;
    container.appendChild(h3);

    block.questions.forEach(q => {
      const div = document.createElement("div");
      div.className = "question-block";
      div.innerHTML = `
        <p><strong>Q${count}:</strong> ${q}</p>
        <textarea id="answer${count}" placeholder="Type your answer here..."></textarea>
        <div class="feedback" id="fb${count}"></div>`;
      container.appendChild(div);
      count++;
    });
  });

  window.totalQuestions = count - 1;
}

// --- Timer ---
let timerInterval = null;

function startTimer(seconds, displayEl, onComplete) {
  let time = seconds;
  clearInterval(timerInterval);
  updateDisplay();

  timerInterval = setInterval(() => {
    time--;
    updateDisplay();
    if (time <= 0) {
      clearInterval(timerInterval);
      if (typeof onComplete === "function") onComplete();
    }
  }, 1000);

  function updateDisplay() {
    const m = String(Math.floor(time / 60)).padStart(2, "0");
    const s = String(time % 60).padStart(2, "0");
    displayEl.textContent = `Time: ${m}:${s}`;
  }
}

// --- Evaluation ---
async function evaluateAnswers() {
  console.log("[core] Evaluating answers...");
  const results = [];
  const n = window.totalQuestions;

  for (let i = 1; i <= n; i++) {
    const ans = document.getElementById(`answer${i}`).value.trim();
    const fb = document.getElementById(`fb${i}`);

    if (!ans) {
      fb.textContent = "⚠️ No answer provided.";
      continue;
    }

    const prompt = `Evaluate this interview answer:\n\n"${ans}"\n\nGive concise feedback using STAR, Bloom’s, CEFR. End with score /5.`;
    fb.textContent = "Evaluating...";
    const feedback = await callLLM(prompt);
    fb.textContent = feedback;
  }

  document.getElementById("generateReportBtn").style.display = "inline-block";
}

// --- Report + PDF ---
let evaluationResults = [];

document.getElementById("generateReportBtn").onclick = generateReport;
document.getElementById("downloadReportBtn").onclick = downloadPDF;

function generateReport() {
  const out = document.getElementById("reportContainer");
  out.innerHTML = "";
  evaluationResults = [];

  for (let i = 1; i <= window.totalQuestions; i++) {
    const q = document.querySelector(`#answer${i}`).previousElementSibling.textContent;
    const a = document.getElementById(`answer${i}`).value;
    const f = document.getElementById(`fb${i}`).textContent;

    const div = document.createElement("div");
    div.innerHTML = `<h4>${q}</h4><p><strong>Answer:</strong> ${a}</p><p><strong>Feedback:</strong> ${f}</p><hr>`;
    out.appendChild(div);
    evaluationResults.push({ question: q, answer: a, feedback: f });
  }

  document.getElementById("generateReportBtn").style.display = "none";
  document.getElementById("downloadReportBtn").style.display = "inline-block";
}

function downloadPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(18);
  doc.text("AI Interview Evaluation Report", 105, 20, { align: "center" });

  let y = 30;
  evaluationResults.forEach((entry, i) => {
    if (y > 270) {
      doc.addPage(); y = 20;
    }
    doc.setFontSize(12);
    doc.text(`Q${i + 1}: ${entry.question}`, 10, y); y += 6;
    const ans = doc.splitTextToSize("Answer: " + entry.answer, 180);
    doc.text(ans, 10, y); y += ans.length * 6;
    const fb = doc.splitTextToSize("Feedback: " + entry.feedback, 180);
    doc.text(fb, 10, y); y += fb.length * 6 + 4;
    doc.line(10, y, 200, y); y += 6;
  });

  doc.save("interview_report.pdf");
}

// --- MAIN INTERVIEW FLOW ---
document.addEventListener("DOMContentLoaded", async () => {
  console.log("[core] DOM ready. Initializing interview...");

  const resume = localStorage.getItem("resumeText") || "";
  const jd = localStorage.getItem("jdText") || "";
  const tech = +localStorage.getItem("techQty") || 0;
  const beh = +localStorage.getItem("behQty") || 0;
  const sit = +localStorage.getItem("sitQty") || 0;
  const time = +localStorage.getItem("interviewTimeLimit") || 10;

  if (!resume || tech + beh + sit === 0) {
    alert("Missing data. Restart from landing page.");
    return window.location.href = "landing.html";
  }

  document.getElementById("interviewTimeLimit").value = time;
  startWebcam();

  // Generate questions
  const prompt = buildPrompt(resume, jd, tech, beh, sit);
  document.getElementById("questionsContainer").innerText = "Generating questions...";
  const raw = await callLLM(prompt);
  const blocks = parseLLMResponse(raw);
  renderQuestions(blocks);
  document.getElementById("evaluateBtn").disabled = false;

  // Timer
  const display = document.getElementById("interviewTimerDisplay");
  startTimer(time * 60, display, () => {
    console.warn("[core] Timer expired.");
    evaluateAnswers();
  });

  // Button actions
  document.getElementById("startWebcamBtn").onclick = startWebcam;
  document.getElementById("stopWebcamBtn").onclick = stopWebcam;
  document.getElementById("evaluateBtn").onclick = evaluateAnswers;
  document.getElementById("resetTimerBtn").onclick = () => {
    startTimer(time * 60, display, evaluateAnswers);
  };
  document.getElementById("stopInterviewBtn").onclick = evaluateAnswers;
});
