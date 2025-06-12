// pripojeni k socket.io serveru
const socket = io();

// nacteni HTML elementu
const nameInput = document.getElementById("name");
const roomCodeInput = document.getElementById("roomCode");
const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");
const lobbyDiv = document.getElementById("lobby");
const roomDisplay = document.getElementById("roomDisplay");
const playersUl = document.getElementById("players");
const startBtn = document.getElementById("startBtn");

const quizDiv = document.getElementById("quiz");
const questionTextP = document.getElementById("questionText");
const answersUl = document.getElementById("answers");
const leaderboardDiv = document.getElementById("leaderboard");

const resultsDiv = document.getElementById("results");
const finalScoresUl = document.getElementById("finalScores");

// pomocne promenne
let currentRoom = null;
let answered = false;
let correctAnswerGlobal = null;
let timerInterval = null;
const QUESTION_TIME = 15; // sekundy

// casovac
const timerP = document.createElement("p");
timerP.id = "timer";
quizDiv.insertBefore(timerP, answersUl);

// vytvoreni mistnosti
createBtn.onclick = () => {
  const name = nameInput.value.trim();
  if (!name) return alert("Zadej sve jmeno.");

  socket.emit("createRoom", ({ code }) => {
    currentRoom = code;
    roomDisplay.textContent = currentRoom;
    showLobby();
    startBtn.style.display = "inline-block";
    socket.emit("joinRoom", { code, name }, () => {});
  });
};

// pripojeni do mistnosti
joinBtn.onclick = () => {
  const name = nameInput.value.trim();
  const code = roomCodeInput.value.trim();
  if (!name || !code) return alert("Zadej jmeno a kod mistnosti.");

  socket.emit("joinRoom", { code, name }, ({ success, error }) => {
    if (success) {
      currentRoom = code;
      roomDisplay.textContent = currentRoom;
      showLobby();
      startBtn.style.display = "none";
    } else alert(error);
  });
};

// start hry
startBtn.onclick = () => {
  socket.emit("startGame", currentRoom);
};

// aktualizace hracu v lobby
socket.on("playersUpdate", (players) => {
  playersUl.innerHTML = "";
  players.forEach(p => {
    const li = document.createElement("li");
    li.textContent = `${p.name} - skore: ${p.score}`;
    playersUl.appendChild(li);
  });
});

// zobrazeni otazky
socket.on("question", (q) => {
  showQuiz();
  answered = false;
  correctAnswerGlobal = null;
  questionTextP.textContent = q.question;
  answersUl.innerHTML = "";
  leaderboardDiv.innerHTML = "";
  timerP.textContent = "";

  q.answers.forEach(a => {
    const li = document.createElement("li");
    li.textContent = a;
    li.onclick = () => {
      if (answered) return;
      answered = true;
      socket.emit("answer", { code: currentRoom, answer: a });
      disableAnswers();
      stopTimer();
    };
    answersUl.appendChild(li);
  });

  startTimer(QUESTION_TIME);
});

// zobrazeni spravne odpovedi
socket.on("answerResult", ({ correctAnswer }) => {
  correctAnswerGlobal = correctAnswer;
  [...answersUl.children].forEach(li => {
    li.style.pointerEvents = "none";
    if (li.textContent === correctAnswer) {
      li.style.backgroundColor = "lightgreen";
    } else if (li.textContent !== correctAnswer && li.style.backgroundColor !== "lightgreen") {
      if (answered && li.style.backgroundColor === "") {
        li.style.backgroundColor = "salmon";
      }
    }
  });
});

// leaderboard - prubezne poradi
socket.on("leaderboardUpdate", (players) => {
  leaderboardDiv.innerHTML = "<h3>Prubezne poradi:</h3>";
  const ul = document.createElement("ul");
  players.forEach((p, index) => {
    const li = document.createElement("li");
    li.textContent = `${index + 1}. ${p.name}: ${p.score} bodu`;
    ul.appendChild(li);
  });
  leaderboardDiv.appendChild(ul);
});

// konec hry
socket.on("gameOver", (players) => {
  showResults(players);
});

// mistnost byla zavrena
socket.on("roomClosed", () => {
  alert("Mistnost byla uzavrena hostitelem.");
  location.reload();
});

// zobraz lobby
function showLobby() {
  document.getElementById("joinCreate").style.display = "none";
  lobbyDiv.style.display = "block";
  quizDiv.style.display = "none";
  resultsDiv.style.display = "none";
}

// zobraz kviz
function showQuiz() {
  lobbyDiv.style.display = "none";
  quizDiv.style.display = "block";
  resultsDiv.style.display = "none";
  clearResultsHighlight();
}

// zobraz vysledky
function showResults(players) {
  lobbyDiv.style.display = "none";
  quizDiv.style.display = "none";
  resultsDiv.style.display = "block";
  finalScoresUl.innerHTML = "";
  players.sort((a,b) => b.score - a.score);
  players.forEach(p => {
    const li = document.createElement("li");
    li.textContent = `${p.name}: ${p.score} bodu`;
    finalScoresUl.appendChild(li);
  });
}

// zakaz kliknuti na odpovedi
function disableAnswers() {
  [...answersUl.children].forEach(li => li.style.pointerEvents = "none");
}

// reset barvy odpovedi
function clearResultsHighlight() {
  [...answersUl.children].forEach(li => {
    li.style.backgroundColor = "";
    li.style.pointerEvents = "auto";
  });
}

// start casovace
function startTimer(seconds) {
  let timeLeft = seconds;
  timerP.textContent = `Cas: ${timeLeft}s`;
  timerInterval = setInterval(() => {
    timeLeft--;
    timerP.textContent = `Cas: ${timeLeft}s`;
    if (timeLeft <= 0) {
      stopTimer();
      if (!answered) {
        answered = true;
        disableAnswers();
        socket.emit("answer", { code: currentRoom, answer: null });
      }
    }
  }, 1000);
}

// zastaveni casovace
function stopTimer() {
  clearInterval(timerInterval);
}
