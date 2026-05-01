const QUESTION_BANK = [
  { question: "Which data structure uses FIFO order?", options: ["Stack", "Queue", "Tree", "Graph"], answer: 1 },
  { question: "Which company created WhatsApp?", options: ["Meta", "Microsoft", "Oracle", "Adobe"], answer: 0 },
  { question: "What does HTML stand for?", options: ["Hyper Text Markup Language", "High Transfer Machine Language", "Hyperlinking Text Machine Logic", "Home Tool Markup Language"], answer: 0 },
  { question: "What is the capital of Japan?", options: ["Seoul", "Tokyo", "Beijing", "Bangkok"], answer: 1 },
  { question: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Saturn"], answer: 1 },
  { question: "What is the largest mammal on Earth?", options: ["Elephant", "Blue Whale", "Giraffe", "Hippopotamus"], answer: 1 },
  { question: "Which programming language was created by Brendan Eich?", options: ["Python", "Java", "JavaScript", "Ruby"], answer: 2 },
  { question: "What does CPU stand for?", options: ["Central Processing Unit", "Computer Personal Unit", "Central Program Utility", "Computer Processing Unit"], answer: 0 },
  { question: "What is the chemical symbol for gold?", options: ["Go", "Gd", "Au", "Ag"], answer: 2 },
  { question: "How many continents are there on Earth?", options: ["5", "6", "7", "8"], answer: 2 },
  { question: "What is the hardest natural substance on Earth?", options: ["Gold", "Iron", "Diamond", "Platinum"], answer: 2 },
  { question: "Which social media company owns Instagram?", options: ["Google", "Twitter", "Meta", "TikTok"], answer: 2 },
  { question: "What is the largest ocean on Earth?", options: ["Atlantic", "Indian", "Pacific", "Arctic"], answer: 2 },
  { question: "Who painted the Mona Lisa?", options: ["Van Gogh", "Picasso", "Da Vinci", "Michelangelo"], answer: 2 },
  { question: "What year did World War II end?", options: ["1943", "1944", "1945", "1946"], answer: 2 },
  { question: "What is the largest organ in the human body?", options: ["Heart", "Liver", "Skin", "Brain"], answer: 2 },
  { question: "Which country has the largest population?", options: ["USA", "India", "China", "Indonesia"], answer: 2 },
  { question: "What does RAM stand for?", options: ["Random Access Memory", "Read Access Memory", "Rapid Access Module", "Read Only Memory"], answer: 0 },
  { question: "Which is the fastest land animal?", options: ["Cheetah", "Lion", "Horse", "Leopard"], answer: 0 },
];

const MAX_MATH = 30;
const MAX_GUESS = 20;

class GameService {
  constructor() {
    this._mathSessions = new Map();
    this._guessSessions = new Map();
    this._triviaSessions = new Map();
    this._rpsSessions = new Map();
    this.cleanupSessions();
  }

  cleanupSessions() {
    setInterval(() => {
      const now = Date.now();
      for (const [id, session] of this._mathSessions) {
        if (session.expiresAt < now) this._mathSessions.delete(id);
      }
      for (const [id, session] of this._guessSessions) {
        if (session.expiresAt < now) this._guessSessions.delete(id);
      }
      for (const [id, session] of this._triviaSessions) {
        if (session.expiresAt < now) this._triviaSessions.delete(id);
      }
    }, 60 * 1000);
  }

  startMath(senderId) {
    const left = Math.floor(Math.random() * MAX_MATH) + 2;
    const right = Math.floor(Math.random() * MAX_MATH) + 2;
    const op = ["+", "-", "*"][Math.floor(Math.random() * 3)];
    const answer = op === "+" ? left + right : op === "-" ? left - right : left * right;
    this._mathSessions.set(senderId, {
      answer,
      question: `${left} ${op} ${right}`,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
    return `${left} ${op} ${right}`;
  }

  answerMath(senderId, value) {
    const session = this._mathSessions.get(senderId);
    if (!session || session.expiresAt < Date.now()) {
      this._mathSessions.delete(senderId);
      return null;
    }
    const correct = Number(value) === session.answer;
    if (correct) {
      this._mathSessions.delete(senderId);
    }
    return { correct, answer: session.answer, question: session.question };
  }

  startGuess(senderId) {
    const target = Math.floor(Math.random() * MAX_GUESS) + 1;
    this._guessSessions.set(senderId, {
      target,
      attemptsLeft: 5,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    return { min: 1, max: MAX_GUESS };
  }

  submitGuess(senderId, value) {
    const session = this._guessSessions.get(senderId);
    if (!session || session.expiresAt < Date.now()) {
      this._guessSessions.delete(senderId);
      return null;
    }
    session.attemptsLeft -= 1;
    const guess = Number(value);
    if (guess === session.target) {
      this._guessSessions.delete(senderId);
      return { status: "correct", target: session.target };
    }
    if (session.attemptsLeft <= 0) {
      this._guessSessions.delete(senderId);
      return { status: "lost", target: session.target };
    }
    return { status: guess < session.target ? "higher" : "lower", attemptsLeft: session.attemptsLeft };
  }

  startTrivia(senderId) {
    const entry = QUESTION_BANK[Math.floor(Math.random() * QUESTION_BANK.length)];
    this._triviaSessions.set(senderId, {
      answer: entry.answer,
      question: entry.question,
      options: entry.options,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    return entry;
  }

  answerTrivia(senderId, input) {
    const session = this._triviaSessions.get(senderId);
    if (!session || session.expiresAt < Date.now()) {
      this._triviaSessions.delete(senderId);
      return null;
    }
    const normalized = String(input || "").trim().toLowerCase();
    const answerIndex = Number.parseInt(normalized, 10) - 1;
    const matchedIndex = Number.isInteger(answerIndex)
      ? answerIndex
      : session.options.findIndex((option) => option.toLowerCase() === normalized);
    const correct = matchedIndex === session.answer;
    if (correct) {
      this._triviaSessions.delete(senderId);
    }
    return { correct, correctIndex: session.answer, correctAnswer: session.options[session.answer], options: session.options };
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
    const wins = (normalized === "rock" && botChoice === "scissors") || (normalized === "paper" && botChoice === "rock") || (normalized === "scissors" && botChoice === "paper");
    return { outcome: wins ? "win" : "lose", botChoice };
  }

  playRpsNumber(choice) {
    const options = ["rock", "paper", "scissors"];
    const botChoice = options[Math.floor(Math.random() * options.length)];
    if (choice === botChoice) {
      return { outcome: "draw", botChoice };
    }
    const wins = (choice === "rock" && botChoice === "scissors") || (choice === "paper" && botChoice === "rock") || (choice === "scissors" && botChoice === "paper");
    return { outcome: wins ? "win" : "lose", botChoice };
  }

  startRpsSession(senderId) {
    this._rpsSessions?.set(senderId, { expiresAt: Date.now() + 60 * 1000 });
  }

  clearRpsSession(senderId) {
    this._rpsSessions?.delete(senderId);
  }

  playSlot() {
    const icons = ["🍒", "⭐", "💎", "7️⃣", "🍀"];
    const roll = Array.from({ length: 3 }, () => icons[Math.floor(Math.random() * icons.length)]);
    const counts = roll.reduce((acc, icon) => { acc[icon] = (acc[icon] || 0) + 1; return acc; }, {});
    const best = Math.max(...Object.values(counts));
    let outcome = "miss";
    if (best === 3) outcome = "jackpot";
    else if (best === 2) outcome = "pair";
    return { roll, outcome };
  }

  maybeHandleRpsReply({ message, services }) {
    const senderId = message.senderId;
    const session = this._rpsSessions?.get(senderId);
    if (!session || session.expiresAt < Date.now()) {
      return false;
    }
    const text = String(message.text || "").trim();
    const choiceNum = parseInt(text, 10);
    if (isNaN(choiceNum) || ![1, 2, 3].includes(choiceNum)) {
      return false;
    }
    const choices = ["rock", "paper", "scissors"];
    const playerChoice = choices[choiceNum - 1];
    this._rpsSessions.delete(senderId);
    const result = this.playRpsNumber(playerChoice);
    const reward = { xp: 12, cash: 30 };
    const emoji = result.outcome === "win" ? "✅" : result.outcome === "draw" ? "🤝" : "❌";
    const emojis = { rock: "🪨", paper: "📄", scissors: "✂️" };
    return services.xp.addXp(senderId, reward.xp).then(() =>
      services.economy.rewardGame(senderId, reward)
    ).then(async (balance) => {
      await message.reply(
        `🎮 *RPS Result*\n\n` +
        `You: ${emojis[playerChoice]} ${playerChoice}\n` +
        `Bot: ${emojis[result.botChoice]} ${result.botChoice}\n\n` +
        `${emoji} ${result.outcome.toUpperCase()}\n\n` +
        `💰 +$${reward.cash} | +${reward.xp} XP`
      );
      return true;
    });
  }

  maybeHandleTriviaReply({ message, services }) {
    const senderId = message.senderId;
    const session = this._triviaSessions?.get(senderId);
    if (!session || session.expiresAt < Date.now()) {
      return false;
    }
    const text = String(message.text || "").trim();
    const answerIndex = parseInt(text, 10) - 1;
    if (isNaN(answerIndex) || answerIndex < 0 || answerIndex >= session.options.length) {
      return false;
    }
    const correct = answerIndex === session.answer;
    const correctAnswer = session.options[session.answer];
    this._triviaSessions.delete(senderId);
    const reward = { xp: 20, cash: 50 };
    if (correct) {
      return services.xp.addXp(senderId, reward.xp).then(() =>
        services.economy.rewardGame(senderId, reward)
      ).then(async () => {
        await message.reply(`✅ Correct! +${reward.xp} XP | +$${reward.cash}\n\nAnswer: ${correctAnswer}`);
        return true;
      });
    } else {
      message.reply(`❌ Wrong! Answer: ${correctAnswer}`);
      return true;
    }
  }
}

module.exports = { GameService };