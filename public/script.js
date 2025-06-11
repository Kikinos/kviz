const socket = io();

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

const resultsDiv = document.getElementById("results");
const finalScoresUl = document.getElementById("finalScores");

let currentRoom = null;
let answered = false;
let correctAnswerGlobal = null;
let timerInterval = null;
const QUESTION_TIME = 15;

const timerP = document.createElement("p");
timerP.id = "timer";
quizDiv.insertBefore(timerP, answersUl);

createBtn.onclick = () => {
  const name = nameInput.value.trim();
  if (!name) return alert("Zadej své jméno.");

  socket.emit("createRoom", ({ code }) => {
    currentRoom = code;
    roomDisplay.textContent = currentRoom;
    showLobby();
    startBtn.style.display = "inline-block";
    socket.emit("joinRoom", { code, name }, () => {});
  });
};

joinBtn.onclick = () => {
  const name = nameInput.value.trim();
  const code = roomCodeInput.value.trim();
  if (!name || !code) return alert("Zadej jméno a kód místnosti.");

  socket.emit("joinRoom", { code, name }, ({ success, error }) => {
    if (success) {
      currentRoom = code;
      roomDisplay.textContent = currentRoom;
      showLobby();
      startBtn.style.display = "none";
    } else alert(error);
  });
};

startBtn.onclick = () => {
  socket.emit("startGame", currentRoom);
};

socket.on("playersUpdate", (players) => {
  playersUl.innerHTML = "";
  players.forEach(p => {
    const li = document.createElement("li");
    li.textContent = `${p.name} - skóre: ${p.score}`;
    playersUl.appendChild(li);
  });
});

socket.on("question", (q) => {
  showQuiz();
  answered = false;
  correctAnswerGlobal = null;
  questionTextP.textContent = q.question;
  answersUl.innerHTML = "";

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

socket.on("gameOver", (players) => {
  showResults(players);
});

socket.on("roomClosed", () => {
  alert("Místnost byla uzavřena hostitelem.");
  location.reload();
});

function showLobby() {
  document.getElementById("joinCreate").style.display = "none";
  lobbyDiv.style.display = "block";
  quizDiv.style.display = "none";
  resultsDiv.style.display = "none";
}

function showQuiz() {
  lobbyDiv.style.display = "none";
  quizDiv.style.display = "block";
  resultsDiv.style.display = "none";
  clearResultsHighlight();
}

function showResults(players) {
  lobbyDiv.style.display = "none";
  quizDiv.style.display = "none";
  resultsDiv.style.display = "block";
  finalScoresUl.innerHTML = "";
  players.sort((a,b) => b.score - a.score);
  players.forEach(p => {
    const li = document.createElement("li");
    li.textContent = `${p.name}: ${p.score} bodů`;
    finalScoresUl.appendChild(li);
  });
}

function disableAnswers() {
  [...answersUl.children].forEach(li => li.style.pointerEvents = "none");
}

function clearResultsHighlight() {
  [...answersUl.children].forEach(li => {
    li.style.backgroundColor = "";
    li.style.pointerEvents = "auto";
  });
}

function startTimer(seconds) {
  let timeLeft = seconds;
  timerP.textContent = `Čas: ${timeLeft}s`;
  timerInterval = setInterval(() => {
    timeLeft--;
    timerP.textContent = `Čas: ${timeLeft}s`;
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

function stopTimer() {
  clearInterval(timerInterval);
  timerP.textContent = "";
}