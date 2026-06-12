import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { signInWithPopup, signOut } from 'firebase/auth';
import { auth, googleProvider } from './firebaseConfig';

export type Match = {
  id: string;
  home: string;
  away: string;
  date: string;
  time: string;
  league: string;
  status: string;
};

export type Prediction = {
  id: string;
  userId: string;
  matchId: string;
  market: string;
  selection: string;
  predictedHomeScore?: number;
  predictedAwayScore?: number;
  cost?: number;
  createdAt: string;
  status: string;
};

export type Result = {
  id: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  status: string;
  date: string | null;
  league: string | null;
  source: string;
};

export type User = {
  id: string;
  email: string;
  username: string;
  walletAddress: string | null;
  points?: number;
  credits?: number;
};

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
const PREDICTION_COST = 20;

const OUTCOME_OPTIONS = [
  { id: 'HOME', label: 'Gana local' },
  { id: 'DRAW', label: 'Empate' },
  { id: 'AWAY', label: 'Gana visitante' }
];

function getOutcomeLabel(selection: string) {
  return OUTCOME_OPTIONS.find((option) => option.id === selection)?.label || selection;
}

function App() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [selectedOutcome, setSelectedOutcome] = useState<string>('HOME');
  const [predictedHomeScore, setPredictedHomeScore] = useState<string>('1');
  const [predictedAwayScore, setPredictedAwayScore] = useState<string>('0');
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string>('');
  const [walletAddressInput, setWalletAddressInput] = useState<string>('');
  const [resultsLoading, setResultsLoading] = useState<boolean>(false);
  const [selectedCompetition, setSelectedCompetition] = useState<string>('Todas');

  const fetchUserProfile = async (authToken: string) => {
    try {
      const response = await axios.get<{ user: User }>(`${API_BASE}/api/users/me`, {
        headers: {
          Authorization: `Bearer ${authToken}`
        }
      });
      const profile = response.data.user;
      setUser(profile);
      localStorage.setItem('polla-user', JSON.stringify(profile));
      if (profile.walletAddress) {
        setWalletAddressInput(profile.walletAddress);
      }
    } catch (error) {
      console.warn('No se pudo obtener perfil de usuario.', error);
    }
  };

  const selectedMatch = useMemo(
    () => matches.find((match) => match.id === selectedMatchId),
    [matches, selectedMatchId]
  );

  const selectedResult = useMemo(
    () => results.find((result) => result.id === selectedMatchId),
    [results, selectedMatchId]
  );

  const liveResults = useMemo(
    () => results.filter((result) => result.status === 'LIVE'),
    [results]
  );

  const upcomingResults = useMemo(
    () => results.filter((result) => result.status === 'SCHEDULED'),
    [results]
  );

  const competitionOptions = useMemo(() => {
    const competitions = new Set<string>();
    results.forEach((result) => {
      if (result.league) {
        competitions.add(result.league);
      }
    });
    return ['Todas', ...Array.from(competitions).sort()];
  }, [results]);

  const selectedResults = useMemo(() => {
    const filtered = selectedCompetition === 'Todas'
      ? results
      : results.filter((result) => result.league === selectedCompetition);
    return filtered;
  }, [results, selectedCompetition]);

  const filteredLiveResults = useMemo(
    () => selectedResults.filter((result) => result.status === 'LIVE'),
    [selectedResults]
  );

  const filteredUpcomingResults = useMemo(
    () => selectedResults.filter((result) => result.status === 'SCHEDULED'),
    [selectedResults]
  );

  const recentResults = useMemo(
    () => selectedResults.filter((result) => result.status !== 'LIVE' && result.status !== 'SCHEDULED').slice(0, 10),
    [selectedResults]
  );

  const fetchResults = async () => {
    setResultsLoading(true);
    try {
      const response = await axios.get<Result[]>(`${API_BASE}/api/results`);
      setResults(response.data);
    } catch (error) {
      setStatusMessage('No se pudieron cargar los resultados.');
    } finally {
      setResultsLoading(false);
    }
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('polla-user');
    const savedToken = localStorage.getItem('polla-token');
    if (savedUser && savedToken) {
      const parsedUser = JSON.parse(savedUser) as User;
      setUser(parsedUser);
      setToken(savedToken);
      if (parsedUser.walletAddress) {
        setWalletAddressInput(parsedUser.walletAddress);
      }
      fetchUserProfile(savedToken);
    }
  }, []);

  useEffect(() => {
    axios
      .get<Match[]>(`${API_BASE}/api/matches`)
      .then((response) => setMatches(response.data))
      .catch(() => setStatusMessage('No se pudieron cargar los partidos.'));

    fetchResults();
  }, []);

  useEffect(() => {
    axios
      .get<Prediction[]>(`${API_BASE}/api/predictions`)
      .then((response) => setPredictions(response.data))
      .catch(() => setStatusMessage('No se pudieron cargar las predicciones.'));
  }, []);


  const logout = async () => {
    await signOut(auth).catch(() => undefined);
    setUser(null);
    setToken('');
    setWalletAddressInput('');
    localStorage.removeItem('polla-user');
    localStorage.removeItem('polla-token');
    setStatusMessage('Sesión cerrada.');
  };

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const firebaseUser = result.user;
      const tokenId = await firebaseUser.getIdToken();
      const username = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'firebase-user';

      const appUser = {
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        username,
        walletAddress: null
      };

      setUser(appUser);
      setToken(tokenId);
      localStorage.setItem('polla-user', JSON.stringify(appUser));
      localStorage.setItem('polla-token', tokenId);
      setStatusMessage(`Sesión iniciada como ${username}.`);
      fetchUserProfile(tokenId);
    } catch (error) {
      setStatusMessage('No se pudo iniciar sesión con Google.');
    }
  };

  const submitPrediction = async () => {
    if (!user) {
      setStatusMessage('Debes iniciar sesión antes de enviar una predicción.');
      return;
    }

    const homeScore = Number(predictedHomeScore);
    const awayScore = Number(predictedAwayScore);

    if (!selectedMatchId || !selectedOutcome) {
      setStatusMessage('Selecciona un partido y un ganador.');
      return;
    }

    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) {
      setStatusMessage('Ingresa un marcador exacto valido.');
      return;
    }

    const scoreOutcome = homeScore > awayScore ? 'HOME' : awayScore > homeScore ? 'AWAY' : 'DRAW';
    if (scoreOutcome !== selectedOutcome) {
      setStatusMessage('El ganador seleccionado no coincide con el marcador.');
      return;
    }

    try {
      const response = await axios.post<{ prediction: Prediction; user: User }>(
        `${API_BASE}/api/predictions`,
        {
          matchId: selectedMatchId,
          outcome: selectedOutcome,
          homeScore,
          awayScore
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      setPredictions((prev) => [response.data.prediction, ...prev]);
      setUser(response.data.user);
      localStorage.setItem('polla-user', JSON.stringify(response.data.user));
      setStatusMessage('Prediccion guardada.');
    } catch (error) {
      const message = axios.isAxiosError(error) && error.response?.data?.error
        ? error.response.data.error
        : 'No se pudo enviar la prediccion.';
      setStatusMessage(message);
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Polla Predictions MVP</h1>
        <p>Escoge un partido y envía tu pronóstico.</p>
        <div className="auth-card">
          {user ? (
            <div className="auth-info">
              <span>Hola, {user.username}</span>
              <span>{user.email}</span>
              <div className="profile-details">
                <div>Créditos: {user.credits ?? 0}</div>
                <div>Pts: {user.points ?? 0}</div>
              </div>
              <div className="wallet-form">
                <input
                  type="text"
                  value={walletAddressInput}
                  onChange={(event) => setWalletAddressInput(event.target.value)}
                  placeholder="Wallet Solana (USDT)"
                />
                <button type="button" onClick={async () => {
                  if (!walletAddressInput.trim()) {
                    setStatusMessage('Ingresa una wallet válida.');
                    return;
                  }
                  try {
                    const response = await axios.put<{ user: User }>(
                      `${API_BASE}/api/users/me`,
                      { walletAddress: walletAddressInput.trim() },
                      {
                        headers: {
                          Authorization: `Bearer ${token}`
                        }
                      }
                    );
                    setUser(response.data.user);
                    localStorage.setItem('polla-user', JSON.stringify(response.data.user));
                    setStatusMessage('Wallet guardada.');
                  } catch (error) {
                    setStatusMessage('No se pudo guardar la wallet.');
                  }
                }}>
                  Guardar wallet
                </button>
              </div>
              <button type="button" onClick={logout}>
                Cerrar sesión
              </button>
            </div>
          ) : (
            <div className="login-form">
              <button type="button" onClick={loginWithGoogle} className="google-button">
                Iniciar con Google
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="app-main">
        <section className="match-list">
          <h2>Partidos disponibles</h2>
          {matches.length === 0 ? (
            <p>Cargando partidos...</p>
          ) : (
            <ul>
              {matches.map((match) => (
                <li key={match.id}>
                  <button
                    type="button"
                    className={match.id === selectedMatchId ? 'selected' : ''}
                    onClick={() => setSelectedMatchId(match.id)}
                  >
                    {match.home} vs {match.away} · {match.league}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="prediction-panel">
          <h2>Tu predicción</h2>
          {selectedMatch ? (
            <>
              <div className="match-summary">
                <strong>{selectedMatch.home}</strong> vs <strong>{selectedMatch.away}</strong>
                <span>
                  {selectedMatch.date} · {selectedMatch.time}
                </span>
              </div>
              {selectedResult ? (
                <div className="match-result">
                  <p>Resultado actual:</p>
                  <strong>
                    {selectedResult.home} {selectedResult.homeScore} - {selectedResult.awayScore} {selectedResult.away}
                  </strong>
                  <p>{selectedResult.status}</p>
                </div>
              ) : (
                <p>No hay resultado disponible aún para este partido.</p>
              )}
              <div className="market-picker">
                <p>Ganador</p>
                <div className="option-grid">
                  {OUTCOME_OPTIONS.map((outcome) => (
                    <button
                      key={outcome.id}
                      type="button"
                      className={outcome.id === selectedOutcome ? 'selected' : ''}
                      onClick={() => setSelectedOutcome(outcome.id)}
                    >
                      {outcome.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="score-picker">
                <p>Marcador exacto</p>
                <div className="score-grid">
                  <label>
                    <span>{selectedMatch.home}</span>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={predictedHomeScore}
                      onChange={(event) => setPredictedHomeScore(event.target.value)}
                    />
                  </label>
                  <strong>-</strong>
                  <label>
                    <span>{selectedMatch.away}</span>
                    <input
                      type="number"
                      min="0"
                      max="30"
                      value={predictedAwayScore}
                      onChange={(event) => setPredictedAwayScore(event.target.value)}
                    />
                  </label>
                </div>
              </div>

              <p className="prediction-cost">Costo: {PREDICTION_COST} creditos</p>
              <button type="button" onClick={submitPrediction}>
                Enviar prediccion
              </button>
            </>
          ) : (
            <p>Selecciona un partido para comenzar.</p>
          )}

          {statusMessage && <div className="status-message">{statusMessage}</div>}
        </section>

        <section className="results-panel">
          <div className="results-header">
            <div>
              <h2>Resultados</h2>
              <p>Ver partidos en vivo y próximos por competición.</p>
            </div>
            <button
              type="button"
              className="refresh-button"
              onClick={fetchResults}
              disabled={resultsLoading}
            >
              {resultsLoading ? 'Actualizando...' : 'Actualizar resultados'}
            </button>
          </div>

          {results.length === 0 ? (
            <p>Cargando resultados...</p>
          ) : (
            <>
              <div className="competition-filter">
                <label htmlFor="competition-select">Competición:</label>
                <select
                  id="competition-select"
                  value={selectedCompetition}
                  onChange={(event) => setSelectedCompetition(event.target.value)}
                >
                  {competitionOptions.map((competition) => (
                    <option key={competition} value={competition}>
                      {competition}
                    </option>
                  ))}
                </select>
              </div>

              <div className="results-summary">
                <div>{filteredLiveResults.length} partido(s) en vivo</div>
                <div>{filteredUpcomingResults.length} próximos partidos</div>
                <div>{recentResults.length} resultados recientes</div>
              </div>

              <div className="results-list">
                {filteredLiveResults.length > 0 && (
                  <div className="results-group">
                    <h3>En vivo</h3>
                    <ul>
                      {filteredLiveResults.map((result) => (
                        <li key={result.id} className="result-item">
                          <div>
                            <strong>{result.home}</strong> {result.homeScore} - {result.awayScore} <strong>{result.away}</strong>
                          </div>
                          <div className="result-meta">
                            <span>{result.league ?? 'Sin liga'}</span>
                            <span className="result-status result-status-live">LIVE</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {filteredUpcomingResults.length > 0 && (
                  <div className="results-group">
                    <h3>Próximos partidos</h3>
                    <ul>
                      {filteredUpcomingResults.map((result) => (
                        <li key={result.id} className="result-item">
                          <div>
                            <strong>{result.home}</strong> vs <strong>{result.away}</strong>
                          </div>
                          <div className="result-meta">
                            <span>{result.league ?? 'Sin liga'}</span>
                            <span>{new Date(result.date ?? '').toLocaleString()}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {recentResults.length > 0 && (
                  <div className="results-group">
                    <h3>Últimos resultados</h3>
                    <ul>
                      {recentResults.map((result) => (
                        <li key={result.id} className="result-item">
                          <div>
                            <strong>{result.home}</strong> {result.homeScore} - {result.awayScore} <strong>{result.away}</strong>
                          </div>
                          <div className="result-meta">
                            <span>{result.league ?? 'Sin liga'}</span>
                            <span>{result.status}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </>
          )}
        </section>

        <section className="prediction-history">
          <h2>Predicciones recientes</h2>
          {predictions.length === 0 ? (
            <p>No hay predicciones aún.</p>
          ) : (
            <ul>
              {predictions.map((prediction) => (
                <li key={prediction.id}>
                  <strong>
                    {getOutcomeLabel(prediction.selection)} · {prediction.predictedHomeScore ?? '-'} - {prediction.predictedAwayScore ?? '-'}
                  </strong>
                  <span>{new Date(prediction.createdAt).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
