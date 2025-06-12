// nacitani knihoven
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fetch = require("node-fetch");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// nastaveni slozky public pro staticke soubory
app.use(express.static("public"));

// seznam mistnosti
const rooms = {}; // kazda mistnost ma hrace, hostitele, otazky, atd.

// generovani nahodneho kodu mistnosti
function generateRoomCode() {
  return Math.random().toString(36).substring(2, 7).toUpperCase();
}

// ziskani otazek z api
async function getQuestions(amount = 10) {
  const res = await fetch(`https://opentdb.com/api.php?amount=${amount}&type=multiple`);
  const data = await res.json();
  return data.results.map(q => {
    const answers = [...q.incorrect_answers];
    const correctIndex = Math.floor(Math.random() * 4);
    answers.splice(correctIndex, 0, q.correct_answer);
    return {
      question: q.question,
      answers,
      correct: q.correct_answer
    };
  });
}

// po pripojeni uzivatele
io.on("connection", (socket) => {
  // vytvoreni mistnosti
  socket.on("createRoom", async (callback) => {
    const code = generateRoomCode();
    rooms[code] = {
      players: [],
      hostId: socket.id,
      questions: [],
      currentQ: 0,
      answered: {},
      timer: null
    };
    callback({ code });
  });

  // pripojeni do mistnosti
  socket.on("joinRoom", ({ code, name }, callback) => {
    const room = rooms[code];
    if (!room) return callback({ success: false, error: "Mistnost neexistuje." });

    room.players.push({ id: socket.id, name, score: 0 });
    socket.join(code);
    io.to(code).emit("playersUpdate", room.players);
    callback({ success: true });
  });

  // spusteni hry
  socket.on("startGame", async (code) => {
    const room = rooms[code];
    if (!room) return;

    room.questions = await getQuestions();
    room.currentQ = 0;
    room.answered = {};
    sendQuestion(code);
  });

  // zpracovani odpovedi hrace
  socket.on("answer", ({ code, answer }) => {
    const room = rooms[code];
    if (!room) return;
    if (room.answered[socket.id]) return;

    const player = room.players.find(p => p.id === socket.id);
    const q = room.questions[room.currentQ];
    const isCorrect = answer === q.correct;

    if (isCorrect) player.score += 100;
    room.answered[socket.id] = { isCorrect, answer };

    io.to(socket.id).emit("answerResult", {
      isCorrect,
      correctAnswer: q.correct,
      selectedAnswer: answer
    });

    // posli prubezne poradi
    const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);
    io.to(code).emit("leaderboardUpdate", sortedPlayers);

    // pokud odpovedeli vsichni, ukaz dalsi
    if (Object.keys(room.answered).length === room.players.length) {
      clearTimeout(room.timer);
      showScoreAndNext(code);
    }
  });

  // odpojeni uzivatele
  socket.on("disconnect", () => {
    for (const code in rooms) {
      const room = rooms[code];
      room.players = room.players.filter(p => p.id !== socket.id);
      delete room.answered[socket.id];

      if (room.players.length === 0) {
        delete rooms[code];
      } else {
        io.to(code).emit("playersUpdate", room.players);
      }
    }
  });
});

// odeslani otazky vsem hracum v mistnosti
function sendQuestion(code) {
  const room = rooms[code];
  const q = room.questions[room.currentQ];

  room.answered = {};
  io.to(code).emit("question", q);

  room.timer = setTimeout(() => {
    showScoreAndNext(code);
  }, 15000); // 15 sekund
}

// po kazde otazce ukaz odpovedi a pak dalsi otazku nebo konec
function showScoreAndNext(code) {
  const room = rooms[code];
  const currentQuestion = room.questions[room.currentQ];

  // zvyrazni odpoved pro vsechny, i ty co neodpovedeli
  room.players.forEach(p => {
    if (!room.answered[p.id]) {
      io.to(p.id).emit("answerResult", {
        isCorrect: false,
        correctAnswer: currentQuestion.correct,
        selectedAnswer: null
      });
    }
  });

  io.to(code).emit("playersUpdate", room.players);

  // znovu posli poradi
  const sortedPlayers = [...room.players].sort((a, b) => b.score - a.score);
  io.to(code).emit("leaderboardUpdate", sortedPlayers);

  // cekej 5 sekund, pak dalsi otazka nebo konec hry
  setTimeout(() => {
    room.currentQ++;
    if (room.currentQ < room.questions.length) {
      sendQuestion(code);
    } else {
      io.to(code).emit("gameOver", room.players);
    }
  }, 5000);
}

// spusteni serveru
server.listen(3000, () => {
  console.log("Server bezi na http://localhost:3000");
});
