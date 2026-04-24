const QUESTION_BANK = [
  {
    question: "Which data structure uses FIFO order?",
    options: ["Stack", "Queue", "Tree", "Graph"],
    answer: 1,
  },
  {
    question: "Which company created WhatsApp?",
    options: ["Meta", "Microsoft", "Oracle", "Adobe"],
    answer: 0,
  },
  {
    question: "What does HTML stand for?",
    options: [
      "Hyper Text Markup Language",
      "High Transfer Machine Language",
      "Hyperlinking Text Machine Logic",
      "Home Tool Markup Language",
    ],
    answer: 0,
  },
];

class GameService {
  constructor() {
    this.mathSessions = new Map();
    this.guessSessions = new Map();
    this.triviaSessions = new Map();
  }

  startMath(jid) {
    const left = Math.floor(Math.random() * 15) + 2;
    const right = Math.floor(Math.random() * 12) + 2;
    const op = ["+", "-", "*"][Math.floor(Math.random() * 3)];
    const answer = op === "+" ? left + right : op === "-" ? left - right : left * right;
    this.mathSessions.set(jid, {
      answer,
      question: `${left} ${op} ${right}`,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });

    return `${left} ${op} ${right}`;
  }

  answerMath(jid, value) {
    const session = this.mathSessions.get(jid);
    if (!session || session.expiresAt < Date.now()) {
      this.mathSessions.delete(jid);
      return null;
    }

    const correct = Number(value) === session.answer;
    if (correct) {
      this.mathSessions.delete(jid);
    }

    return { correct, answer: session.answer, question: session.question };
  }

  startGuess(jid) {
    const target = Math.floor(Math.random() * 10) + 1;
    this.guessSessions.set(jid, {
      target,
      attemptsLeft: 5,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    return { min: 1, max: 10 };
  }

  submitGuess(jid, value) {
    const session = this.guessSessions.get(jid);
    if (!session || session.expiresAt < Date.now()) {
      this.guessSessions.delete(jid);
      return null;
    }

    session.attemptsLeft -= 1;
    const guess = Number(value);
    if (guess === session.target) {
      this.guessSessions.delete(jid);
      return { status: "correct", target: session.target };
    }

    if (session.attemptsLeft <= 0) {
      this.guessSessions.delete(jid);
      return { status: "lost", target: session.target };
    }

    return {
      status: guess < session.target ? "higher" : "lower",
      attemptsLeft: session.attemptsLeft,
    };
  }

  startTrivia(jid) {
    const entry = QUESTION_BANK[Math.floor(Math.random() * QUESTION_BANK.length)];
    this.triviaSessions.set(jid, {
      answer: entry.answer,
      question: entry.question,
      options: entry.options,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    return entry;
  }

  answerTrivia(jid, input) {
    const session = this.triviaSessions.get(jid);
    if (!session || session.expiresAt < Date.now()) {
      this.triviaSessions.delete(jid);
      return null;
    }

    const normalized = String(input || "").trim().toLowerCase();
    const answerIndex = Number.parseInt(normalized, 10) - 1;
    const matchedIndex = Number.isInteger(answerIndex)
      ? answerIndex
      : session.options.findIndex((option) => option.toLowerCase() === normalized);
    const correct = matchedIndex === session.answer;
    if (correct) {
      this.triviaSessions.delete(jid);
    }

    return {
      correct,
      correctIndex: session.answer,
      correctAnswer: session.options[session.answer],
      options: session.options,
    };
  }

  playRps(choice) {
    const normalized = String(choice || "").trim().toLowerCase();
    const options = ["rock", "paper", "scissors"];
    if (!options.includes(normalized)) {
      throw new Error("Choose rock, paper, or scissors.");
    }

    const botChoice = options[Math.floor(Math.random() * options.length)];
    if (normalized === botChoice) {
      return { outcome: "draw", botChoice };
    }

    const wins =
      (normalized === "rock" && botChoice === "scissors") ||
      (normalized === "paper" && botChoice === "rock") ||
      (normalized === "scissors" && botChoice === "paper");

    return { outcome: wins ? "win" : "lose", botChoice };
  }

  playSlot() {
    const icons = ["🍒", "⭐", "💎", "7️⃣", "🍀"];
    const roll = Array.from({ length: 3 }, () => icons[Math.floor(Math.random() * icons.length)]);
    const counts = roll.reduce((acc, icon) => {
      acc[icon] = (acc[icon] || 0) + 1;
      return acc;
    }, {});
    const best = Math.max(...Object.values(counts));
    return {
      roll,
      outcome: best === 3 ? "jackpot" : best === 2 ? "pair" : "miss",
    };
  }
}

module.exports = {
  GameService,
};
