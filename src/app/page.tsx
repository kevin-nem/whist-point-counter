"use client";
import { useState, useMemo } from "react";

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 6;

function getRoundSequence(numPlayers: number): number[] {
  // 1 up to 8, N rounds of 8, then down to 1
  const up = Array.from({ length: 8 }, (_, i) => i + 1); // [1..8]
  const hold = Array(numPlayers).fill(8); // N rounds of 8
  const down = Array.from({ length: 7 }, (_, i) => 7 - i); // [7..1]
  return [...up, ...hold, ...down];
}

export default function Home() {
  const [numPlayers, setNumPlayers] = useState<number>(MIN_PLAYERS);
  const [playerNames, setPlayerNames] = useState<string[]>(Array(MIN_PLAYERS).fill(""));
  const [started, setStarted] = useState(false);
  const [roundIdx, setRoundIdx] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [bets, setBets] = useState<string[]>([]);
  const [tricks, setTricks] = useState<string[]>([]);
  const [phase, setPhase] = useState<'bet' | 'result'>('bet');
  const [allBets, setAllBets] = useState<number[][]>([]); // store all bets per round
  const [gameOver, setGameOver] = useState(false);

  const roundSequence = useMemo(() => getRoundSequence(numPlayers), [numPlayers]);
  const totalRounds = roundSequence.length;
  const cardsThisRound = roundSequence[roundIdx];

  // Reset everything when starting a new game
  const startGame = () => {
    setScores(Array(numPlayers).fill(0));
    setRoundIdx(0);
    setPhase('bet');
    setBets(Array(numPlayers).fill(""));
    setTricks(Array(numPlayers).fill(""));
    setAllBets([]);
    setGameOver(false);
    setStarted(true);
  };

  // Player name and number logic (unchanged)
  const handleNumPlayersChange = (n: number) => {
    setNumPlayers(n);
    setPlayerNames((prev) => {
      const newArr = [...prev];
      if (n > prev.length) {
        return [...newArr, ...Array(n - prev.length).fill("")];
      } else {
        return newArr.slice(0, n);
      }
    });
  };

  const handleNameChange = (idx: number, value: string) => {
    setPlayerNames((prev) => {
      const newArr = [...prev];
      newArr[idx] = value;
      return newArr;
    });
  };

  const canStart = playerNames.every((name) => name.trim().length > 0);

  // --- Betting phase ---
  const handleBetChange = (idx: number, value: string) => {
    if (/^\d{0,2}$/.test(value)) {
      setBets((prev) => {
        const newArr = [...prev];
        newArr[idx] = value;
        return newArr;
      });
    }
  };
  const betsSum = bets.reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0);
  const canSubmitBets = bets.every((val) => val.trim() !== "") && betsSum !== cardsThisRound;
  const betsError = bets.every((val) => val.trim() !== "") && betsSum === cardsThisRound;

  // --- Tricks phase ---
  const handleTrickChange = (idx: number, value: string) => {
    if (/^\d{0,2}$/.test(value)) {
      setTricks((prev) => {
        const newArr = [...prev];
        newArr[idx] = value;
        return newArr;
      });
    }
  };
  const canSubmitTricks = tricks.every((val) => val.trim() !== "");

  // --- Round submission logic ---
  const handleSubmitBets = () => {
    setAllBets((prev) => [...prev, bets.map((v) => parseInt(v, 10) || 0)]);
    setPhase('result');
  };
  const handleSubmitTricks = () => {
    const tricksNum = tricks.map((v) => parseInt(v, 10) || 0);
    setScores((prev) => prev.map((score, i) => {
      const bet = allBets[roundIdx]?.[i] ?? (parseInt(bets[i], 10) || 0);
      const isWhish = bet === cardsThisRound;
      if (bet === 0) {
        if (tricksNum[i] === 0) {
          return score + 5;
        } else {
          return score - tricksNum[i] * 10;
        }
      } else {
        const diff = Math.abs(tricksNum[i] - bet);
        if (tricksNum[i] === bet) {
          // Success
          return score + bet * (isWhish ? 20 : 10);
        } else {
          // Missed
          return score - diff * (isWhish ? 20 : 10);
        }
      }
    }));
    if (roundIdx + 1 >= totalRounds) {
      setGameOver(true);
    } else {
      setRoundIdx((r) => r + 1);
      setPhase('bet');
      setBets(Array(numPlayers).fill(""));
      setTricks(Array(numPlayers).fill(""));
    }
  };

  // --- Game screens ---
  if (started) {
    if (gameOver) {
      const maxScore = Math.max(...scores);
      const winners = playerNames.filter((_, i) => scores[i] === maxScore);
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <h2 className="text-xl font-bold mb-4">Game Over</h2>
          <div className="mb-4">
            <h3 className="font-semibold mb-2">Final Scores:</h3>
            <ul>
              {playerNames.map((name, i) => (
                <li key={i} className="mb-1">{name}: {scores[i]}</li>
              ))}
            </ul>
          </div>
          <div className="mb-4 font-bold text-green-600">
            Winner{winners.length > 1 ? 's' : ''}: {winners.join(", ")}
          </div>
          <button
            className="mt-2 px-4 py-2 rounded bg-blue-500 text-white font-semibold"
            onClick={() => { setStarted(false); setScores([]); setRoundIdx(0); setGameOver(false); }}
          >
            New Game
          </button>
        </div>
      );
    }
    // --- Betting phase ---
    if (phase === 'bet') {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <h2 className="text-xl font-bold mb-2">Round {roundIdx + 1} / {totalRounds}</h2>
          <div className="mb-2 text-center text-sm">Cards this round: <span className="font-semibold">{cardsThisRound}</span></div>
          <div className="mb-4 w-full max-w-xs bg-white rounded-lg shadow p-4 flex flex-col gap-6">
            <h3 className="font-semibold mb-2 text-center">Enter Bets (Intended Tricks)</h3>
            {playerNames.map((name, idx) => (
              <div key={idx} className="flex items-center gap-4 py-2">
                <span className="w-24 truncate text-base">{name}</span>
                <input
                  type="number"
                  min="0"
                  max={cardsThisRound}
                  className="rounded border px-4 py-4 w-24 text-lg focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
                  value={bets[idx] || ""}
                  onChange={(e) => handleBetChange(idx, e.target.value)}
                  autoComplete="off"
                />
              </div>
            ))}
            {betsError && (
              <div className="text-red-500 text-xs text-center">Total bets cannot equal number of cards ({cardsThisRound})</div>
            )}
            <button
              className={`mt-2 w-full py-4 text-lg rounded bg-blue-500 text-white font-semibold transition-opacity ${canSubmitBets ? "opacity-100" : "opacity-60"}`}
              disabled={!canSubmitBets}
              onClick={handleSubmitBets}
            >
              Lock Bets
            </button>
          </div>
          <div className="w-full max-w-xs bg-gray-50 rounded-lg shadow p-4 mt-4">
            <h4 className="font-semibold mb-2 text-center">Scores</h4>
            <ul className="flex flex-col gap-1">
              {playerNames.map((name, i) => (
                <li key={i} className="flex justify-between"><span>{name}</span><span>{scores[i]}</span></li>
              ))}
            </ul>
          </div>
        </div>
      );
    }
    // --- Tricks phase ---
    if (phase === 'result') {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <h2 className="text-xl font-bold mb-2">Round {roundIdx + 1} / {totalRounds}</h2>
          <div className="mb-2 text-center text-sm">Cards this round: <span className="font-semibold">{cardsThisRound}</span></div>
          <div className="mb-4 w-full max-w-xs bg-white rounded-lg shadow p-4 flex flex-col gap-6">
            <h3 className="font-semibold mb-2 text-center">Enter Tricks Won</h3>
            {playerNames.map((name, idx) => (
              <div key={idx} className="flex items-center gap-4 py-2">
                <span className="w-24 truncate text-base">{name}</span>
                <input
                  type="number"
                  min="0"
                  max={cardsThisRound}
                  className="rounded border px-4 py-4 w-24 text-lg focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm"
                  value={tricks[idx] || ""}
                  onChange={(e) => handleTrickChange(idx, e.target.value)}
                  autoComplete="off"
                />
              </div>
            ))}
            <button
              className={`mt-2 w-full py-4 text-lg rounded bg-blue-500 text-white font-semibold transition-opacity ${canSubmitTricks ? "opacity-100" : "opacity-60"}`}
              disabled={!canSubmitTricks}
              onClick={handleSubmitTricks}
            >
              Submit Tricks
            </button>
          </div>
          <div className="w-full max-w-xs bg-gray-50 rounded-lg shadow p-4 mt-4">
            <h4 className="font-semibold mb-2 text-center">Scores</h4>
            <ul className="flex flex-col gap-1">
              {playerNames.map((name, i) => (
                <li key={i} className="flex justify-between"><span>{name}</span><span>{scores[i]}</span></li>
              ))}
            </ul>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-blue-100 to-white">
      <h1 className="text-2xl font-bold mb-6 text-center">Whist Point Counter</h1>
      <div className="w-full max-w-xs bg-white rounded-lg shadow p-4 flex flex-col gap-4">
        <label className="font-medium text-center">Number of Players</label>
        <div className="flex justify-center gap-2 mb-2">
          {Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => i + MIN_PLAYERS).map((n) => (
            <button
              key={n}
              className={`rounded-full w-10 h-10 flex items-center justify-center border-2 transition-colors ${numPlayers === n ? "bg-blue-500 text-white border-blue-500" : "bg-white text-blue-500 border-blue-300"}`}
              onClick={() => handleNumPlayersChange(n)}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          {Array.from({ length: numPlayers }).map((_, idx) => (
            <input
              key={idx}
              type="text"
              className="rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
              placeholder={`Player ${idx + 1} name`}
              value={playerNames[idx] || ""}
              onChange={(e) => handleNameChange(idx, e.target.value)}
              maxLength={16}
              autoComplete="off"
            />
          ))}
        </div>
        <button
          className={`mt-4 w-full py-2 rounded bg-blue-500 text-white font-semibold transition-opacity ${canStart ? "opacity-100" : "opacity-60"}`}
          disabled={!canStart}
          onClick={startGame}
        >
          Start Game
        </button>
      </div>
      <footer className="mt-8 text-xs text-gray-400 text-center">Mobile-first • Whist Game Counter</footer>
    </div>
  );
}
