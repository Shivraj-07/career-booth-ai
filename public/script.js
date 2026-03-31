/* ===== STATE ===== */
let questions = [];
let answers = [];
let questionCount = 0;
const maxQuestions = 15;

/* ===== START QUIZ ===== */
function startQuiz() {
  answers = [];
  questions = [];
  questionCount = 0;

  const startBtn = document.getElementById("startBtn");
  const nextBtn = document.getElementById("nextBtn");

  if (startBtn) startBtn.style.display = "none";
  if (nextBtn) nextBtn.style.display = "inline-block";

  updateProgress();
  nextQuestion();
}

/* ===== NEXT QUESTION ===== */
async function nextQuestion() {
  if (questionCount >= maxQuestions) {
    generateReport();
    return;
  }

  const qEl = document.getElementById("question");
  if (qEl) qEl.innerText = "🤖 Thinking...";

  try {
    const res = await fetch("/next-question", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        previousAnswers: answers,
        previousQuestions: questions
      })
    });

    const data = await res.json();

    const raw = data.question || "What subjects do you enjoy the most?";
    questions.push(raw);

    /* ===== TEXT CLEANUP ===== */
    let formatted = raw
      .replace(/\s+/g, " ") // clean weird spacing
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
      .trim();

    /* fallback if still broken */
    if (!formatted.includes(" ")) {
      formatted = raw.replace(/(.{5})/g, "$1 ");
    }

    typeText("question", formatted);

  } catch (err) {
    if (qEl) qEl.innerText = "Error loading question.";
  }
}

/* ===== SUBMIT ANSWER ===== */
function submitAnswer() {
  const input = document.getElementById("answer");
  if (!input) return;

  const answer = input.value.trim();
  if (!answer) return;

  answers.push(answer);
  input.value = "";
  questionCount++;

  updateProgress();
  nextQuestion();
}

/* ===== PROGRESS ===== */
function updateProgress() {
  const progressText = document.getElementById("progressText");
  const progressFill = document.getElementById("progressFill");

  if (!progressText || !progressFill) return;

  progressText.innerText = `Question ${questionCount} / ${maxQuestions}`;

  const percent = (questionCount / maxQuestions) * 100;
  progressFill.style.width = percent + "%";
}

/* ===== TYPE EFFECT ===== */
function typeText(id, text) {
  const el = document.getElementById(id);
  if (!el) return;

  el.textContent = "";
  let i = 0;

  function typing() {
    if (i < text.length) {
      el.textContent += text.charAt(i);
      i++;
      setTimeout(typing, 20);
    }
  }

  typing();
}

/* ===== GENERATE REPORT ===== */
async function generateReport() {
  const qEl = document.getElementById("question");
  if (qEl) qEl.innerText = "📊 Generating report...";

  try {
    const res = await fetch("/analyze", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        answers: answers.join("\n")
      })
    });

    const data = await res.json();

    localStorage.setItem("report", data.result);
    window.location.href = "result.html";

  } catch (err) {
    alert("Error generating report");
  }
}

/* ===== RENDER CARDS (RESULT PAGE) ===== */
function renderCards(text) {
  const container = document.getElementById("cards-container");
  if (!container) return;

  if (!text) {
    container.innerHTML = "<p>No report found</p>";
    return;
  }

  const sections = text.split(/(?=\d+\.\s)/);
  container.innerHTML = "";

  sections.forEach(section => {
    if (!section.trim()) return;

    let title = "✨ Section";

    if (section.toLowerCase().includes("career")) title = "";
    else if (section.toLowerCase().includes("skills")) title = "";
    else if (section.toLowerCase().includes("roadmap")) title = "";

    const card = document.createElement("div");
    card.className = "card";

    card.innerHTML = `
      <h3>${title}</h3>
      <p>${section.replace(/\n/g, "<br>")}</p>
    `;

    container.appendChild(card);
  });
}

/* ===== RESULT PAGE LOAD ===== */
if (window.location.pathname.includes("result.html")) {
  const report = localStorage.getItem("report");
  renderCards(report);
}

/* ===== DOWNLOAD PDF ===== */
async function downloadReport() {
  const report = localStorage.getItem("report");
  const name = localStorage.getItem("name");

  const res = await fetch("/download-pdf", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ report, name })
  });

  const blob = await res.blob();
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = "career_report.pdf";
  link.click();
}

/* ===== SEND EMAIL ===== */
async function sendEmail() {
  const email = localStorage.getItem("email");
  const report = localStorage.getItem("report");

  try {
    await fetch("/send-email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email, report })
    });

    alert("📧 Email sent!");
  } catch (err) {
    alert("Email failed");
  }
}