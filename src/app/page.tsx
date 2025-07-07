"use client";
import { useState, useMemo, useRef, useEffect } from "react";

const MIN_PLAYERS = 3;
const MAX_PLAYERS = 6;

function getRoundSequence(numPlayers: number): number[] {
  // 1 to 7, N rounds of 8, then 7 to 1
  const up = Array.from({ length: 7 }, (_, i) => i + 1); // [1..7]
  const hold = Array(numPlayers).fill(8); // N rounds of 8
  const down = Array.from({ length: 7 }, (_, i) => 7 - i); // [7..1]
  return [...up, ...hold, ...down];
}

// Add a helper to calculate per-round points for each player
function calculateRoundPoints({ bets, tricks, cardsThisRound }: { bets: number[]; tricks: number[]; cardsThisRound: number; }) {
  return bets.map((bet, i) => {
    const isWhish = bet === cardsThisRound;
    if (bet === 0) {
      if (tricks[i] === 0) return 5;
      else return -tricks[i] * 10;
    } else {
      const diff = Math.abs(tricks[i] - bet);
      if (tricks[i] === bet) return bet * (isWhish ? 20 : 10);
      else return -diff * (isWhish ? 20 : 10);
    }
  });
}

// Types explicites pour l'historique
type GameRound = {
  bets: number[];
  tricks: number[];
  points: number[];
  cards: number;
};

type GameHistory = {
  date: string;
  playerNames: string[];
  rounds: GameRound[];
  finalScores: number[];
  roundIdx: number;
  inProgress: boolean;
  gameName?: string;
};

export default function Home() {
  // Load history SSR-safe
  const [history, setHistory] = useState<GameHistory[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('ouiste-history');
      if (raw) {
        setHistory(JSON.parse(raw) as GameHistory[]);
      }
    }
  }, []);

  // When showing history modal, reload history
  useEffect(() => {
    if (showHistory && typeof window !== 'undefined') {
      const raw = localStorage.getItem('ouiste-history');
      if (raw) {
        setHistory(JSON.parse(raw) as GameHistory[]);
      }
    }
  }, [showHistory]);

  const [numPlayers, setNumPlayers] = useState<number>(MIN_PLAYERS);
  const [playerNames, setPlayerNames] = useState<string[]>(Array(MIN_PLAYERS).fill(""));
  const [started, setStarted] = useState(false);
  const [roundIdx, setRoundIdx] = useState(0);
  const [scores, setScores] = useState<number[]>([]);
  const [bets, setBets] = useState<string[]>([]);
  const [tricks, setTricks] = useState<string[]>([]);
  const [phase, setPhase] = useState<'bet' | 'result'>('bet');
  const [allBets, setAllBets] = useState<number[][]>([]); // store all bets per round
  const [allTricks, setAllTricks] = useState<number[][]>([]); // store all tricks per round
  const [gameOver, setGameOver] = useState(false);
  // For disabling buttons after click
  const [betSubmitting, setBetSubmitting] = useState(false);
  const [trickSubmitting, setTrickSubmitting] = useState(false);
  // For autoFocus
  const betInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const trickInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  // For game history modal
  const [gameSaved, setGameSaved] = useState(false);
  // Ajoute un champ "Nom de la partie" sur l'écran d'accueil
  const [gameName, setGameName] = useState("");

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
    setAllTricks([]);
    setGameOver(false);
    setStarted(true);
    setGameSaved(false);
  };

  // Resume game from history state
  const resumeGame = () => {
    const last = history.find((g) => g.inProgress);
    if (!last) return;
    setPlayerNames(last.playerNames);
    setNumPlayers(last.playerNames.length);
    setScores(last.finalScores);
    setAllBets(last.rounds.map((r) => r.bets));
    setAllTricks(last.rounds.map((r) => r.tricks));
    setRoundIdx(last.roundIdx || 0);
    setPhase('bet');
    setGameOver(false);
    setStarted(true);
    setGameSaved(false);
    setGameName(last.gameName || "");
  };
  const hasInProgress = history.some((g) => g.inProgress);

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
  const tricksOverLimit = tricks.some((val) => (parseInt(val, 10) || 0) > cardsThisRound);
  const tricksSum = tricks.reduce((sum, val) => sum + (parseInt(val, 10) || 0), 0);
  const tricksSumOver = tricksSum > cardsThisRound;
  const canSubmitTricks = tricks.every((val) => val.trim() !== "") && !tricksOverLimit && !tricksSumOver;

  const handleTrickChange = (idx: number, value: string) => {
    if (/^\d{0,2}$/.test(value)) {
      setTricks((prev) => {
        const newArr = [...prev];
        newArr[idx] = value;
        return newArr;
      });
    }
  };

  // --- Round submission logic ---
  const handleSubmitBets = () => {
    setAllBets((prev) => [...prev, bets.map((v) => parseInt(v, 10) || 0)]);
    setAllTricks((prev) => [...prev, tricks.map((v) => parseInt(v, 10) || 0)]);
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

  // Save game and update history state
  const handleSaveGame = () => {
    // Build per-round points for completed rounds
    const rounds = allBets.map((bets: number[], roundIdx: number) => {
      const tricks = allTricks[roundIdx];
      const cards = roundSequence[roundIdx];
      const points = calculateRoundPoints({ bets, tricks, cardsThisRound: cards });
      return { bets, tricks, points, cards };
    });
    const game = {
      date: new Date().toISOString(),
      playerNames,
      rounds,
      finalScores: scores,
      roundIdx,
      inProgress: !gameOver,
      gameName,
    };
    let prev: GameHistory[] = [];
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('ouiste-history');
      if (raw) {
        prev = JSON.parse(raw) as GameHistory[];
      }
      localStorage.setItem('ouiste-history', JSON.stringify([game, ...prev]));
      setHistory([game, ...prev]);
    }
    setGameSaved(true);
    setTimeout(() => setGameSaved(false), 2000);
  };

  // --- Game screens ---
  if (started) {
    // Top right save button for all game phases
    if (gameOver) {
      const maxScore = Math.max(...scores);
      const winners = playerNames.filter((_, i) => scores[i] === maxScore);
      const SaveButton = (
        <button
          className="mb-2 px-4 py-2 rounded-md bg-slate-800 text-white font-semibold w-full max-w-xs hover:bg-slate-700"
          onClick={handleSaveGame}
        >
          Sauvegarder la partie
        </button>
      );
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-white" style={{ backgroundColor: '#fff', position: 'relative' }}>
          <h2 className="text-xl font-semibold mb-4 text-slate-800 border-b border-gray-300 pb-2">Partie terminée</h2>
          <div className="mb-4 w-full max-w-xs bg-white rounded-md shadow-sm px-4 py-4">
            <h3 className="font-semibold mb-2 text-slate-800 border-b border-gray-300 pb-1">Scores finaux :</h3>
            <ul>
              {playerNames.map((name, i) => (
                <li key={i} className="mb-1 flex justify-between"><span className="text-gray-800">{name}</span><span className="text-gray-800">{scores[i]}</span></li>
              ))}
            </ul>
          </div>
          <div className="mb-4 font-semibold text-yellow-600 text-lg">
            Gagnant{winners.length > 1 ? 's' : ''} : {winners.join(", ")}
          </div>
          {!gameSaved && SaveButton}
          {gameSaved && <div className="mb-2 text-green-600 font-semibold">Partie sauvegardée !</div>}
          <button
            className="mt-2 px-4 py-2 rounded-md bg-slate-800 text-white font-semibold w-full max-w-xs hover:bg-slate-700"
            onClick={() => { setStarted(false); setScores([]); setRoundIdx(0); setGameOver(false); setGameSaved(false); }}
          >
            Nouvelle partie
          </button>
          <button
            className="mt-2 px-4 py-2 rounded-md bg-gray-100 text-slate-800 font-medium w-full max-w-xs border border-gray-300 hover:bg-slate-200"
            onClick={() => { setStarted(false); setScores([]); setRoundIdx(0); setGameOver(false); setGameSaved(false); }}
          >
            Retour à l’accueil
          </button>
        </div>
      );
    }
    // --- Betting phase ---
    if (phase === 'bet') {
      const SaveButton = (
        <button
          className="ml-2 px-3 py-1 rounded-md bg-slate-800 text-white text-xs font-medium shadow-sm hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
          onClick={handleSaveGame}
        >
          Sauvegarder
        </button>
      );
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-0 bg-white overflow-x-hidden px-4" style={{ backgroundColor: '#fff', position: 'relative' }}>
          {/* Progress Bar */}
          <div className="w-full max-w-xs mx-auto pt-4 pb-2">
            <div className="w-full bg-gray-200 rounded-md h-3">
              <div
                className="bg-slate-800 h-3 rounded-md transition-all"
                style={{ width: `${((roundIdx + 1) / totalRounds) * 100}%` }}
              />
            </div>
            <div className="text-center text-xs mt-1 text-gray-700">Manche {roundIdx + 1} / {totalRounds}</div>
          </div>
          <div className="mb-2 text-center text-base font-medium text-gray-800">Cartes cette manche : <span className="font-semibold text-lg text-slate-800">{cardsThisRound}</span></div>
          <div className="mb-4 w-full max-w-xs bg-white rounded-lg shadow px-4 py-4 flex flex-col gap-6">
            <h3 className="font-semibold mb-2 text-center text-lg text-slate-800 border-b border-gray-300 pb-1">Mises (prédiction de plis)</h3>
            {playerNames.map((name, idx) => (
              <div key={idx} className="flex items-center gap-4 py-3 min-h-[44px]">
                <span className="w-24 truncate text-xl font-bold font-mono text-slate-800">{name}</span>
                <input
                  ref={el => { betInputRefs.current[idx] = el; }}
                  type="number"
                  min="0"
                  max={cardsThisRound}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="rounded border px-4 py-4 w-24 text-lg focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm text-center bg-white text-gray-800 placeholder-gray-500"
                  value={bets[idx] || ""}
                  onChange={(e) => handleBetChange(idx, e.target.value)}
                  autoComplete="off"
                  autoFocus={idx === 0}
                  placeholder={`Mise`}
                />
              </div>
            ))}
            {betsError && (
              <div className="text-red-600 text-sm text-center font-semibold mt-2">La somme des mises ne peut pas être égale au nombre de cartes ({cardsThisRound})</div>
            )}
            <button
              className={`w-full py-3 rounded-md bg-slate-800 text-white font-semibold mt-2 transition-opacity hover:bg-slate-700 ${canSubmitBets && !betSubmitting ? "opacity-100" : "opacity-60"}`}
              disabled={!canSubmitBets || betSubmitting}
              onClick={() => { setBetSubmitting(true); handleSubmitBets(); setTimeout(() => setBetSubmitting(false), 500); }}
            >
              Valider la mise
            </button>
          </div>
          <div className="w-full max-w-xs bg-white rounded-lg shadow px-4 py-4 mt-4 mb-24">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-base text-slate-800">Scores</h4>
              <button
                className="ml-2 px-3 py-1 rounded-md bg-slate-800 text-white text-xs font-medium shadow-sm hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
                onClick={handleSaveGame}
              >
                Sauvegarder
              </button>
            </div>
            <ul className="flex flex-col gap-1">
              {playerNames.map((name, i) => (
                <li key={i} className="flex justify-between min-h-[44px] items-center"><span className="text-xl font-bold font-mono text-slate-800">{name}</span><span className="text-xl text-gray-800">{scores[i]}</span></li>
              ))}
            </ul>
          </div>
          {gameSaved && <div className="mb-2 text-green-600 font-semibold">Partie sauvegardée !</div>}
          <button
            className="w-full py-2 rounded-md bg-gray-100 text-slate-800 font-medium mt-2 border border-gray-300 hover:bg-slate-200"
            onClick={() => { setStarted(false); setScores([]); setRoundIdx(0); setGameOver(false); setGameSaved(false); }}
          >
            Retour à l’accueil
          </button>
        </div>
      );
    }
    // --- Tricks phase ---
    if (phase === 'result') {
      const SaveButton = (
        <button
          className="ml-2 px-3 py-1 rounded-md bg-slate-800 text-white text-xs font-medium shadow-sm hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
          onClick={handleSaveGame}
        >
          Sauvegarder
        </button>
      );
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-0 bg-white overflow-x-hidden" style={{ backgroundColor: '#fff', position: 'relative' }}>
          {/* Progress Bar */}
          <div className="w-full max-w-xs mx-auto pt-4 pb-2">
            <div className="w-full bg-gray-200 rounded-md h-3">
              <div
                className="bg-slate-800 h-3 rounded-md transition-all"
                style={{ width: `${((roundIdx + 1) / totalRounds) * 100}%` }}
              />
            </div>
            <div className="text-center text-xs mt-1 text-gray-700">Manche {roundIdx + 1} / {totalRounds}</div>
          </div>
          <div className="mb-2 text-center text-base font-medium text-gray-800">Cartes cette manche : <span className="font-semibold text-lg text-slate-800">{cardsThisRound}</span></div>
          <div className="mb-4 w-full max-w-xs bg-white rounded-lg shadow px-4 py-4 flex flex-col gap-6">
            <h3 className="font-semibold mb-2 text-center text-lg text-slate-800">Plis réalisés</h3>
            {playerNames.map((name, idx) => (
              <div key={idx} className="flex items-center gap-4 py-3 min-h-[44px]">
                <span className="w-24 truncate text-xl font-bold font-mono text-slate-800">{name}</span>
                <input
                  ref={el => { trickInputRefs.current[idx] = el; }}
                  type="number"
                  min="0"
                  max={cardsThisRound}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  className="rounded border px-4 py-4 w-24 text-lg focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-sm text-center bg-white text-gray-800 placeholder-gray-500"
                  value={tricks[idx] || ""}
                  onChange={(e) => handleTrickChange(idx, e.target.value)}
                  autoComplete="off"
                  autoFocus={idx === 0}
                  placeholder={`Plis`}
                />
              </div>
            ))}
            {tricksOverLimit && (
              <div className="text-red-600 text-sm text-center font-semibold mt-2">Un joueur ne peut pas gagner plus de plis que le nombre de cartes de la manche.</div>
            )}
            {tricksSumOver && (
              <div className="text-red-600 text-sm text-center font-semibold mt-2">Le total des plis réalisés ne peut pas dépasser le nombre de cartes de la manche.</div>
            )}
            <button
              className={`w-full py-3 rounded-md bg-slate-800 text-white font-semibold mt-2 transition-opacity hover:bg-slate-700 ${canSubmitTricks && !trickSubmitting ? "opacity-100" : "opacity-60"}`}
              disabled={!canSubmitTricks || trickSubmitting}
              onClick={() => { setTrickSubmitting(true); handleSubmitTricks(); setTimeout(() => setTrickSubmitting(false), 500); }}
            >
              Valider les plis
            </button>
          </div>
          <div className="w-full max-w-xs bg-white rounded-lg shadow px-4 py-4 mt-4 mb-24">
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-semibold text-base text-slate-800">Scores</h4>
              <button
                className="ml-2 px-3 py-1 rounded-md bg-slate-800 text-white text-xs font-medium shadow-sm hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400"
                onClick={handleSaveGame}
              >
                Sauvegarder
              </button>
            </div>
            <ul className="flex flex-col gap-1">
              {playerNames.map((name, i) => (
                <li key={i} className="flex justify-between min-h-[44px]"><span className="text-gray-800">{name}</span><span className="text-xl text-gray-800">{scores[i]}</span></li>
              ))}
            </ul>
          </div>
          {gameSaved && <div className="mb-2 text-green-600 font-semibold">Partie sauvegardée !</div>}
          <button
            className="w-full py-2 rounded-md bg-gray-100 text-slate-800 font-medium mt-2 border border-gray-300 hover:bg-slate-200"
            onClick={() => { setStarted(false); setScores([]); setRoundIdx(0); setGameOver(false); setGameSaved(false); }}
          >
            Retour à l’accueil
          </button>
        </div>
      );
    }
  }

  // Home/setup screen: add View History button and modal
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-slate-50">
      <h1 className="text-2xl font-semibold mb-6 text-center text-slate-800 border-b border-gray-300 pb-2">Compteur de points OUISTE</h1>
      <div className="w-full max-w-xs bg-white rounded-md shadow-sm p-4 flex flex-col gap-4">
        <input
          type="text"
          className="rounded-md border border-gray-300 px-3 py-2 bg-white text-slate-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-slate-300 font-medium mb-2"
          placeholder="Nom de la partie (optionnel)"
          value={gameName}
          onChange={e => setGameName(e.target.value)}
          maxLength={32}
          autoComplete="off"
        />
        <label className="font-medium text-center text-slate-800">Nombre de joueurs</label>
        <div className="flex justify-center gap-2 mb-2">
          {Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, i) => i + MIN_PLAYERS).map((n) => (
            <button
              key={n}
              className={`rounded-md w-10 h-10 flex items-center justify-center border-2 transition-colors text-lg font-medium ${numPlayers === n ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-800 border-gray-300 hover:bg-slate-100"}`}
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
              className="rounded-md border border-gray-300 px-3 py-3 bg-white text-slate-800 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-slate-300"
              placeholder={`Nom du joueur ${idx + 1}`}
              value={playerNames[idx] || ""}
              onChange={(e) => handleNameChange(idx, e.target.value)}
              maxLength={16}
              autoComplete="off"
            />
          ))}
        </div>
        <button
          className={`mt-4 w-full py-2 rounded-md bg-slate-800 text-white font-semibold transition-opacity hover:bg-slate-700 ${canStart ? "opacity-100" : "opacity-60"}`}
          disabled={!canStart}
          onClick={startGame}
        >
          Démarrer la partie
        </button>
        {hasInProgress && (
          <button
            className="w-full py-2 rounded-md bg-yellow-500 text-white font-semibold mb-2 hover:bg-yellow-600"
            onClick={resumeGame}
          >
            Reprendre la partie en cours
          </button>
        )}
        <button
          className="w-full py-2 rounded-md bg-gray-100 text-slate-800 font-medium mt-2 border border-gray-300 hover:bg-slate-100"
          onClick={() => setShowHistory(true)}
        >
          Historique des parties
        </button>
      </div>
      <footer className="mt-8 text-xs text-gray-500 text-center">Ouiste Lover • Le K aka le Goat</footer>
      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
          <div className="bg-white rounded-lg shadow-lg max-w-full w-[95vw] max-h-[90vh] overflow-y-auto p-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800">Historique des parties</h2>
              <button className="text-slate-800 font-bold text-xl" onClick={() => setShowHistory(false)}>&times;</button>
            </div>
            {history.length === 0 ? (
              <div className="text-gray-600">Aucune partie sauvegardée.</div>
            ) : (
              history.map((game, gIdx) => (
                <div key={gIdx} className="mb-8 border-b pb-4">
                  <div className="mb-2 text-sm text-gray-700">{new Date(game.date).toLocaleString()}</div>
                  <div className="overflow-x-auto">
                    <table className="min-w-max w-full text-xs border">
                      <thead>
                        <tr>
                          <th className="border px-2 py-1 bg-slate-50">Manche</th>
                          {game.playerNames.map((name, i) => (
                            <th key={i} className="border px-2 py-1 bg-slate-50">{name}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {game.rounds.map((round, rIdx) => (
                          <tr key={rIdx}>
                            <td className="border px-2 py-1 font-semibold text-slate-800">{rIdx + 1} <br /><span className="text-xs text-gray-500">({round.cards} cartes)</span></td>
                            {game.playerNames.map((_, pIdx) => (
                              <td key={pIdx} className="border px-2 py-1">
                                <div><span className="font-semibold">Mise :</span> {round.bets[pIdx]}</div>
                                <div><span className="font-semibold">Plis :</span> {round.tricks[pIdx]}</div>
                                <div><span className="font-semibold">Pts :</span> {round.points[pIdx]}</div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-2 font-semibold text-slate-800">Scores finaux :</div>
                  <ul className="mb-2">
                    {game.playerNames.map((name, i) => (
                      <li key={i} className="flex justify-between text-gray-800"><span>{name}</span><span>{game.finalScores[i]}</span></li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
