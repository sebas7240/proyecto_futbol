import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type User as FirebaseAuthUser
} from 'firebase/auth';
import { auth, firebaseConfigReady, googleProvider, missingFirebaseConfigKeys } from './firebaseConfig';

export type Match = {
  id: string;
  home: string;
  away: string;
  date: string;
  time: string;
  league: string;
  status: string;
  source?: string;
  homeBadge?: string | null;
  awayBadge?: string | null;
};

export type Prediction = {
  id: string;
  userId: string;
  matchId: string;
  matchHome?: string;
  matchAway?: string;
  matchDate?: string;
  matchTime?: string;
  league?: string;
  market: string;
  selection: string;
  predictedHomeScore?: number;
  predictedAwayScore?: number;
  actualHomeScore?: number;
  actualAwayScore?: number;
  pointsAwarded?: number;
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

export type RankingUser = {
  id: string;
  username: string;
  points: number;
  credits: number;
};

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';
const PREDICTION_COST = 20;
const EXACT_SCORE_POINTS = 10;

const OUTCOME_OPTIONS = [
  { id: 'HOME', label: 'Gana local' },
  { id: 'DRAW', label: 'Empate' },
  { id: 'AWAY', label: 'Gana visitante' }
];

const TABS = [
  { id: 'play', label: 'Jugar' },
  { id: 'ranking', label: 'Ranking' },
  { id: 'history', label: 'Mis jugadas' },
  { id: 'results', label: 'Resultados' }
];

function getOutcomeLabel(selection: string) {
  return OUTCOME_OPTIONS.find((option) => option.id === selection)?.label || selection;
}

function formatMatchDate(match?: Match | null) {
  if (!match?.date) return 'Fecha por confirmar';
  const value = `${match.date}T${match.time || '00:00'}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return `${match.date} ${match.time || ''}`.trim();
  return date.toLocaleString([], { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function getStatusLabel(status: string) {
  if (status === 'SCHEDULED') return 'Abierto';
  if (status === 'LIVE') return 'En vivo';
  if (status === 'FINISHED') return 'Finalizado';
  return status;
}

function isPredictionOpen(match?: Match | null) {
  if (!match) return false;
  if (match.status === 'SCHEDULED') return true;

  if (match.date) {
    const kickoff = new Date(`${match.date}T${match.time || '00:00'}`);
    if (!Number.isNaN(kickoff.getTime()) && kickoff.getTime() > Date.now()) {
      return true;
    }
  }

  return false;
}

function getFirebaseErrorMessage(error: unknown) {
  if (!axios.isAxiosError(error) && typeof error === 'object' && error && 'code' in error) {
    const code = String((error as { code?: string }).code || '');
    if (code === 'auth/popup-closed-by-user') {
      return 'La ventana de Google se cerró antes de terminar. Intentando con redirección segura...';
    }
    if (code === 'auth/popup-blocked') {
      return 'El navegador bloqueó la ventana de Google. Intentando con redirección segura...';
    }
    if (code === 'auth/unauthorized-domain') {
      return `Este dominio no está autorizado en Firebase Auth: ${window.location.hostname}. Agrégalo en Firebase Console > Authentication > Settings > Authorized domains.`;
    }
    if (code === 'auth/operation-not-allowed') {
      return 'El proveedor Google no está habilitado en Firebase Authentication.';
    }
    if (code === 'auth/network-request-failed') {
      return 'Firebase no pudo conectarse. Revisa internet, bloqueadores o restricciones del navegador.';
    }
    return `Firebase rechazó el inicio de sesión: ${code}.`;
  }

  return 'No se pudo iniciar sesión con Google.';
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (!axios.isAxiosError(error)) return fallback;

  if (error.response?.data?.error) {
    return error.response.data.error;
  }

  if (!error.response) {
    return `No se pudo conectar con el backend (${API_BASE}). Revisa que la API esté encendida y que VITE_API_BASE apunte al backend correcto.`;
  }

  return fallback;
}

function App() {
  const isAdminRoute = window.location.pathname.replace(/\/$/, '') === '/admin';
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatchId, setSelectedMatchId] = useState<string>('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [myPredictions, setMyPredictions] = useState<Prediction[]>([]);
  const [ranking, setRanking] = useState<RankingUser[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [settlements, setSettlements] = useState<Result[]>([]);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [selectedOutcome, setSelectedOutcome] = useState<string>('HOME');
  const [predictedHomeScore, setPredictedHomeScore] = useState<string>('1');
  const [predictedAwayScore, setPredictedAwayScore] = useState<string>('0');
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string>('');
  const [walletAddressInput, setWalletAddressInput] = useState<string>('');
  const [resultsLoading, setResultsLoading] = useState<boolean>(false);
  const [selectedCompetition, setSelectedCompetition] = useState<string>('Todas');
  const [activeTab, setActiveTab] = useState<string>('play');
  const [adminSecret, setAdminSecret] = useState<string>('');
  const [adminMatchId, setAdminMatchId] = useState<string>('');
  const [adminHomeScore, setAdminHomeScore] = useState<string>('0');
  const [adminAwayScore, setAdminAwayScore] = useState<string>('0');
  const [adminLoading, setAdminLoading] = useState<boolean>(false);
  const [predictionSubmitting, setPredictionSubmitting] = useState<boolean>(false);

  const selectedMatch = useMemo(
    () => matches.find((match) => match.id === selectedMatchId),
    [matches, selectedMatchId]
  );

  const selectedResult = useMemo(
    () => results.find((result) => result.id === selectedMatchId),
    [results, selectedMatchId]
  );

  const scheduledMatches = useMemo(
    () => matches.filter((match) => match.status === 'SCHEDULED'),
    [matches]
  );

  const openMatches = scheduledMatches.length || matches.length;
  const userRank = useMemo(
    () => ranking.findIndex((item) => item.id === user?.id) + 1,
    [ranking, user]
  );

  const competitionOptions = useMemo(() => {
    const competitions = new Set<string>();
    results.forEach((result) => {
      if (result.league) competitions.add(result.league);
    });
    return ['Todas', ...Array.from(competitions).sort()];
  }, [results]);

  const selectedResults = useMemo(() => {
    return selectedCompetition === 'Todas'
      ? results
      : results.filter((result) => result.league === selectedCompetition);
  }, [results, selectedCompetition]);

  const liveResults = useMemo(
    () => selectedResults.filter((result) => result.status === 'LIVE'),
    [selectedResults]
  );

  const upcomingResults = useMemo(
    () => selectedResults.filter((result) => result.status === 'SCHEDULED'),
    [selectedResults]
  );

  const recentResults = useMemo(
    () => selectedResults.filter((result) => result.status !== 'LIVE' && result.status !== 'SCHEDULED').slice(0, 10),
    [selectedResults]
  );

  const recentSettlements = useMemo(
    () => settlements.slice(0, 8),
    [settlements]
  );

  const fetchMatches = async () => {
    const response = await axios.get<Match[]>(`${API_BASE}/api/matches`);
    setMatches(response.data);
    setSelectedMatchId((current) => current || response.data.find((match) => match.status === 'SCHEDULED')?.id || response.data[0]?.id || '');
    setAdminMatchId((current) => current || response.data[0]?.id || '');
  };

  const fetchRanking = async () => {
    const response = await axios.get<RankingUser[]>(`${API_BASE}/api/ranking`);
    setRanking(response.data);
  };

  const fetchPredictions = async () => {
    const response = await axios.get<Prediction[]>(`${API_BASE}/api/predictions`);
    setPredictions(response.data);
  };

  const fetchMyPredictions = async (authToken = token) => {
    if (!authToken) return;
    const response = await axios.get<Prediction[]>(`${API_BASE}/api/predictions/me`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    setMyPredictions(response.data);
  };

  const fetchResults = async () => {
    setResultsLoading(true);
    try {
      const response = await axios.get<Result[]>(`${API_BASE}/api/results`);
      setResults(response.data);
      const settlementResponse = await axios.get<Result[]>(`${API_BASE}/api/results/settlements`);
      setSettlements(settlementResponse.data);
    } catch (error) {
      setStatusMessage('No se pudieron cargar los resultados.');
    } finally {
      setResultsLoading(false);
    }
  };

  const refreshPublicData = async () => {
    await Promise.all([
      fetchMatches().catch(() => setStatusMessage('No se pudieron cargar los partidos.')),
      fetchRanking().catch(() => setStatusMessage('No se pudo cargar el ranking.')),
      fetchPredictions().catch(() => undefined),
      fetchResults()
    ]);
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('polla-user');
    const savedToken = localStorage.getItem('polla-token');
    if (savedUser && savedToken) {
      const parsedUser = JSON.parse(savedUser) as User;
      setUser(parsedUser);
      setToken(savedToken);
      if (parsedUser.walletAddress) setWalletAddressInput(parsedUser.walletAddress);
      fetchUserProfile(savedToken);
      fetchMyPredictions(savedToken).catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    refreshPublicData();
  }, []);

  const fetchUserProfile = async (authToken: string) => {
    try {
      const response = await axios.get<{ user: User }>(`${API_BASE}/api/users/me`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      const profile = response.data.user;
      setUser(profile);
      localStorage.setItem('polla-user', JSON.stringify(profile));
      if (profile.walletAddress) setWalletAddressInput(profile.walletAddress);
    } catch (error) {
      console.warn('No se pudo obtener perfil de usuario.', error);
    }
  };

  const completeFirebaseLogin = async (firebaseUser: FirebaseAuthUser, messagePrefix = 'Sesión iniciada') => {
    const tokenId = await firebaseUser.getIdToken();
    const username = firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'jugador';
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
    setStatusMessage(`${messagePrefix} como ${username}.`);
    await Promise.all([fetchUserProfile(tokenId), fetchMyPredictions(tokenId), fetchRanking()]);
  };

  useEffect(() => {
    if (!firebaseConfigReady) return;

    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) {
          completeFirebaseLogin(result.user, 'Sesión completada');
        }
      })
      .catch((error) => {
        setStatusMessage(getFirebaseErrorMessage(error));
      });
  }, []);

  const logout = async () => {
    await signOut(auth).catch(() => undefined);
    setUser(null);
    setToken('');
    setWalletAddressInput('');
    setMyPredictions([]);
    localStorage.removeItem('polla-user');
    localStorage.removeItem('polla-token');
    setStatusMessage('Sesión cerrada.');
  };

  const loginWithGoogle = async () => {
    if (!firebaseConfigReady) {
      setStatusMessage(`Falta configuración de Firebase: ${missingFirebaseConfigKeys.join(', ')}.`);
      return;
    }

    try {
      const result = await signInWithPopup(auth, googleProvider);
      await completeFirebaseLogin(result.user);
    } catch (error) {
      const message = getFirebaseErrorMessage(error);
      setStatusMessage(message);

      const code = typeof error === 'object' && error && 'code' in error
        ? String((error as { code?: string }).code || '')
        : '';

      if (code === 'auth/popup-closed-by-user' || code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, googleProvider);
      }
    }
  };

  const selectMatch = (matchId: string) => {
    setSelectedMatchId(matchId);
    setActiveTab('play');
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

    if (!isPredictionOpen(selectedMatch)) {
      setStatusMessage('Este partido ya no acepta predicciones. Selecciona un partido abierto.');
      return;
    }

    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) {
      setStatusMessage('Ingresa un marcador exacto válido.');
      return;
    }

    const scoreOutcome = homeScore > awayScore ? 'HOME' : awayScore > homeScore ? 'AWAY' : 'DRAW';
    if (scoreOutcome !== selectedOutcome) {
      setStatusMessage('El ganador seleccionado no coincide con el marcador.');
      return;
    }

    setPredictionSubmitting(true);
    try {
      const response = await axios.post<{ prediction: Prediction; user: User }>(
        `${API_BASE}/api/predictions`,
        { matchId: selectedMatchId, outcome: selectedOutcome, homeScore, awayScore },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setPredictions((prev) => [response.data.prediction, ...prev]);
      setMyPredictions((prev) => [response.data.prediction, ...prev]);
      setUser(response.data.user);
      localStorage.setItem('polla-user', JSON.stringify(response.data.user));
      setActiveTab('history');
      setStatusMessage(`Predicción registrada. Se descontaron ${PREDICTION_COST} créditos. Si aciertas el marcador exacto sumas ${EXACT_SCORE_POINTS} puntos.`);
      await Promise.all([fetchRanking(), fetchMyPredictions()]);
    } catch (error) {
      setStatusMessage(getApiErrorMessage(error, 'No se pudo enviar la predicción.'));
    } finally {
      setPredictionSubmitting(false);
    }
  };

  const saveWallet = async () => {
    if (!walletAddressInput.trim()) {
      setStatusMessage('Ingresa una wallet válida.');
      return;
    }

    try {
      const response = await axios.put<{ user: User }>(
        `${API_BASE}/api/users/me`,
        { walletAddress: walletAddressInput.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUser(response.data.user);
      localStorage.setItem('polla-user', JSON.stringify(response.data.user));
      setStatusMessage('Wallet guardada.');
    } catch (error) {
      setStatusMessage('No se pudo guardar la wallet.');
    }
  };

  const syncSportsDbMatches = async () => {
    if (!adminSecret.trim()) {
      setStatusMessage('Ingresa ADMIN_SECRET para sincronizar.');
      return;
    }

    setAdminLoading(true);
    try {
      const response = await axios.post<{ synced: number; settled: number; matches: Match[] }>(
        `${API_BASE}/api/matches/sync/thesportsdb`,
        { settleFinished: true },
        { headers: { 'x-admin-secret': adminSecret.trim() } }
      );

      if (response.data.matches.length > 0) {
        setMatches(response.data.matches);
        setSelectedMatchId((current) => current || response.data.matches[0]?.id || '');
        setAdminMatchId((current) => current || response.data.matches[0]?.id || '');
      }
      await Promise.all([fetchResults(), fetchRanking(), fetchPredictions()]);
      setStatusMessage(`TheSportsDB sincronizó ${response.data.synced} partido(s). Liquidó ${response.data.settled}.`);
    } catch (error) {
      const message = axios.isAxiosError(error) && error.response?.data?.error
        ? error.response.data.error
        : 'No se pudo sincronizar TheSportsDB.';
      setStatusMessage(message);
    } finally {
      setAdminLoading(false);
    }
  };

  const settleMatchFromAdmin = async () => {
    if (!adminSecret.trim()) {
      setStatusMessage('Ingresa ADMIN_SECRET para liquidar.');
      return;
    }

    const homeScore = Number(adminHomeScore);
    const awayScore = Number(adminAwayScore);

    if (!adminMatchId || !Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || awayScore < 0) {
      setStatusMessage('Selecciona partido y marcador final válido.');
      return;
    }

    setAdminLoading(true);
    try {
      const response = await axios.post(
        `${API_BASE}/api/results/settle`,
        { matchId: adminMatchId, homeScore, awayScore },
        { headers: { 'x-admin-secret': adminSecret.trim() } }
      );

      await Promise.all([fetchResults(), fetchPredictions(), fetchRanking()]);
      setStatusMessage(`Partido liquidado. Ganadores: ${response.data.winners ?? 0}.`);
    } catch (error) {
      const message = axios.isAxiosError(error) && error.response?.data?.error
        ? error.response.data.error
        : 'No se pudo liquidar el partido.';
      setStatusMessage(message);
    } finally {
      setAdminLoading(false);
    }
  };

  if (isAdminRoute) {
    return (
      <div className="app-shell admin-shell">
        <header className="admin-page-header">
          <div>
            <span className="eyebrow">Golea Predictions</span>
            <h1>Admin interno</h1>
            <p>Sincroniza partidos, liquida marcadores y revisa la operación sin mezclarlo con la vista pública.</p>
          </div>
          <a href="/" className="text-link">Volver a la web</a>
        </header>

        {statusMessage && <div className="status-message">{statusMessage}</div>}

        <section className="admin-panel">
          <div className="admin-header">
            <div>
              <h2>Operación deportiva</h2>
              <p>TheSportsDB gratis + liquidación exacta.</p>
            </div>
            <button type="button" onClick={syncSportsDbMatches} disabled={adminLoading}>
              {adminLoading ? 'Procesando...' : 'Sincronizar y liquidar'}
            </button>
          </div>

          <div className="admin-grid">
            <label>
              <span>ADMIN_SECRET</span>
              <input type="password" value={adminSecret} onChange={(event) => setAdminSecret(event.target.value)} placeholder="Clave admin del backend" />
            </label>
            <label>
              <span>Partido</span>
              <select value={adminMatchId} onChange={(event) => setAdminMatchId(event.target.value)}>
                <option value="">Selecciona partido</option>
                {matches.map((match) => (
                  <option key={match.id} value={match.id}>{match.home} vs {match.away} - {match.league}</option>
                ))}
              </select>
            </label>
            <label>
              <span>Local</span>
              <input type="number" min="0" max="30" value={adminHomeScore} onChange={(event) => setAdminHomeScore(event.target.value)} />
            </label>
            <label>
              <span>Visitante</span>
              <input type="number" min="0" max="30" value={adminAwayScore} onChange={(event) => setAdminAwayScore(event.target.value)} />
            </label>
          </div>

          <button type="button" className="settle-button" onClick={settleMatchFromAdmin} disabled={adminLoading}>Liquidar partido manualmente</button>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <nav className="topbar">
          <div className="brand-lockup">
            <div className="brand-mark">G</div>
            <div>
              <strong>Golea Predictions</strong>
              <span>Marcador exacto</span>
            </div>
          </div>
          {user ? (
            <div className="user-pill">
              <span>{user.username}</span>
              <button type="button" onClick={logout}>Salir</button>
            </div>
          ) : (
            <button type="button" className="google-button compact" onClick={loginWithGoogle}>Entrar con Google</button>
          )}
        </nav>

        <div className="hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">Polla deportiva diaria</span>
            <h1>Acierta el marcador exacto y sube en el ranking.</h1>
            <p>Elige un partido, marca ganador y resultado final. Cada jugada cuesta créditos virtuales y cada acierto exacto suma puntos.</p>
            <div className="hero-actions">
              <button type="button" onClick={() => setActiveTab('play')}>Jugar ahora</button>
              <button type="button" className="ghost-button" onClick={() => setActiveTab('ranking')}>Ver ranking</button>
            </div>
          </div>

          <div className="featured-match">
            <span className="match-status">{selectedMatch ? getStatusLabel(selectedMatch.status) : 'Agenda'}</span>
            {selectedMatch ? (
              <>
                <div className="team-row">
                  <TeamBadge name={selectedMatch.home} badge={selectedMatch.homeBadge} />
                  <strong>vs</strong>
                  <TeamBadge name={selectedMatch.away} badge={selectedMatch.awayBadge} />
                </div>
                <h2>{selectedMatch.home} vs {selectedMatch.away}</h2>
                <p>{selectedMatch.league} · {formatMatchDate(selectedMatch)}</p>
              </>
            ) : (
              <>
                <h2>Sin partidos cargados</h2>
                <p>Sincroniza la agenda desde el admin para empezar.</p>
              </>
            )}
          </div>
        </div>
      </header>

      {statusMessage && <div className="status-message">{statusMessage}</div>}

      <section className="stats-grid">
        <StatCard label="Partidos abiertos" value={openMatches} />
        <StatCard label="Tus créditos" value={user?.credits ?? 0} />
        <StatCard label="Tus puntos" value={user?.points ?? 0} />
        <StatCard label="Tu puesto" value={userRank > 0 ? `#${userRank}` : '-'} />
      </section>

      <nav className="section-tabs" aria-label="Secciones principales">
        {TABS.map((tab) => (
          <button key={tab.id} type="button" className={activeTab === tab.id ? 'active' : ''} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="app-main">
        {activeTab === 'play' && (
          <>
            <section className="panel match-list">
              <div className="panel-heading">
                <span className="eyebrow">Agenda</span>
                <h2>Partidos disponibles</h2>
              </div>
              {matches.length === 0 ? (
                <p>Cargando partidos...</p>
              ) : (
                <ul className="match-card-list">
                  {matches.map((match) => (
                    <li key={match.id}>
                      <button type="button" className={match.id === selectedMatchId ? 'match-card selected' : 'match-card'} onClick={() => selectMatch(match.id)}>
                        <div className="match-card-teams">
                          <TeamBadge name={match.home} badge={match.homeBadge} compact />
                          <span>vs</span>
                          <TeamBadge name={match.away} badge={match.awayBadge} compact />
                        </div>
                        <div>
                          <strong>{match.home} vs {match.away}</strong>
                          <span>{match.league} · {formatMatchDate(match)}</span>
                        </div>
                        <em>{isPredictionOpen(match) ? getStatusLabel(match.status) : 'Cerrado'}</em>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel prediction-panel">
              <div className="panel-heading">
                <span className="eyebrow">Tu jugada</span>
                <h2>Marcador exacto</h2>
              </div>
              {selectedMatch ? (
                <>
                  <div className="match-summary">
                    <strong>{selectedMatch.home}</strong>
                    <span>{selectedMatch.league} · {formatMatchDate(selectedMatch)}</span>
                    <strong>{selectedMatch.away}</strong>
                  </div>

                  {selectedResult && (
                    <div className="match-result">
                      <span>Resultado actual</span>
                      <strong>{selectedResult.home} {selectedResult.homeScore} - {selectedResult.awayScore} {selectedResult.away}</strong>
                    </div>
                  )}

                  <div className="market-picker">
                    <p>Ganador</p>
                    <div className="option-grid">
                      {OUTCOME_OPTIONS.map((outcome) => (
                        <button key={outcome.id} type="button" className={outcome.id === selectedOutcome ? 'selected' : ''} onClick={() => setSelectedOutcome(outcome.id)}>
                          {outcome.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="score-picker">
                    <p>Resultado final</p>
                    <div className="score-grid">
                      <label>
                        <span>{selectedMatch.home}</span>
                        <input type="number" min="0" max="30" value={predictedHomeScore} onChange={(event) => setPredictedHomeScore(event.target.value)} />
                      </label>
                      <strong>-</strong>
                      <label>
                        <span>{selectedMatch.away}</span>
                        <input type="number" min="0" max="30" value={predictedAwayScore} onChange={(event) => setPredictedAwayScore(event.target.value)} />
                      </label>
                    </div>
                  </div>

                  <div className="prediction-rules">
                    <span>Costo: {PREDICTION_COST} créditos</span>
                    <span>Acierto exacto: +{EXACT_SCORE_POINTS} puntos</span>
                  </div>

                  <div className="submit-row">
                    <span>{isPredictionOpen(selectedMatch) ? 'Tu jugada quedará pendiente hasta el resultado final.' : 'Este partido está cerrado para predicciones.'}</span>
                    <button type="button" onClick={submitPrediction} disabled={predictionSubmitting || !isPredictionOpen(selectedMatch)}>
                      {predictionSubmitting ? 'Registrando...' : 'Enviar predicción'}
                    </button>
                  </div>
                </>
              ) : (
                <p>Selecciona un partido para comenzar.</p>
              )}
            </section>
          </>
        )}

        {activeTab === 'ranking' && (
          <section className="panel full-panel">
            <div className="panel-heading">
              <span className="eyebrow">Competencia</span>
              <h2>Ranking general</h2>
            </div>
            <RankingList ranking={ranking} currentUserId={user?.id} />
          </section>
        )}

        {activeTab === 'history' && (
          <section className="panel full-panel">
            <div className="panel-heading">
              <span className="eyebrow">Historial</span>
              <h2>Mis jugadas</h2>
            </div>
            {!user ? (
              <div className="empty-state">
                <p>Inicia sesión para ver tus predicciones, puntos y resultados.</p>
                <button type="button" onClick={loginWithGoogle}>Entrar con Google</button>
              </div>
            ) : (
              <>
                <WalletBox value={walletAddressInput} onChange={setWalletAddressInput} onSave={saveWallet} />
                <PredictionList predictions={myPredictions} emptyText="Todavía no has hecho predicciones." />
              </>
            )}
          </section>
        )}

        {activeTab === 'results' && (
          <section className="panel full-panel">
            <div className="results-header">
              <div className="panel-heading">
                <span className="eyebrow">Resultados</span>
                <h2>En vivo y liquidados</h2>
              </div>
              <button type="button" className="refresh-button" onClick={fetchResults} disabled={resultsLoading}>
                {resultsLoading ? 'Actualizando...' : 'Actualizar'}
              </button>
            </div>

            <div className="competition-filter">
              <label htmlFor="competition-select">Competición</label>
              <select id="competition-select" value={selectedCompetition} onChange={(event) => setSelectedCompetition(event.target.value)}>
                {competitionOptions.map((competition) => (
                  <option key={competition} value={competition}>{competition}</option>
                ))}
              </select>
            </div>

            <div className="results-summary">
              <div>{liveResults.length} en vivo</div>
              <div>{upcomingResults.length} próximos</div>
              <div>{recentSettlements.length} liquidados</div>
            </div>

            <ResultGroups liveResults={liveResults} upcomingResults={upcomingResults} recentResults={recentResults} settlements={recentSettlements} />
          </section>
        )}
      </main>

      <section className="panel activity-panel">
        <div className="panel-heading">
          <span className="eyebrow">Actividad</span>
          <h2>Últimas predicciones</h2>
        </div>
        <PredictionList predictions={predictions.slice(0, 6)} emptyText="No hay predicciones aún." compact />
      </section>
    </div>
  );
}

function TeamBadge({ name, badge, compact = false }: { name: string; badge?: string | null; compact?: boolean }) {
  return (
    <div className={compact ? 'team-badge compact-team' : 'team-badge'}>
      {badge ? <img src={badge} alt="" loading="lazy" /> : <span>{name.slice(0, 1).toUpperCase()}</span>}
      {!compact && <strong>{name}</strong>}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function WalletBox({ value, onChange, onSave }: { value: string; onChange: (value: string) => void; onSave: () => void }) {
  return (
    <div className="wallet-box">
      <div>
        <strong>Wallet de premios</strong>
        <span>Solo se usará si llegas a ser elegible para pagos manuales.</span>
      </div>
      <input type="text" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Wallet Solana" />
      <button type="button" onClick={onSave}>Guardar</button>
    </div>
  );
}

function RankingList({ ranking, currentUserId }: { ranking: RankingUser[]; currentUserId?: string }) {
  if (ranking.length === 0) {
    return <p>No hay ranking todavía.</p>;
  }

  return (
    <ol className="ranking-list">
      {ranking.slice(0, 30).map((item, index) => (
        <li key={item.id} className={item.id === currentUserId ? 'current-user' : ''}>
          <span>#{index + 1}</span>
          <strong>{item.username}</strong>
          <em>{item.points} pts</em>
        </li>
      ))}
    </ol>
  );
}

function PredictionList({ predictions, emptyText, compact = false }: { predictions: Prediction[]; emptyText: string; compact?: boolean }) {
  if (predictions.length === 0) {
    return <p>{emptyText}</p>;
  }

  return (
    <ul className={compact ? 'prediction-list compact-list' : 'prediction-list'}>
      {predictions.map((prediction) => (
        <li key={prediction.id}>
          <div>
            <strong>{prediction.matchHome && prediction.matchAway ? `${prediction.matchHome} vs ${prediction.matchAway}` : prediction.matchId}</strong>
            <span>{getOutcomeLabel(prediction.selection)} · {prediction.predictedHomeScore ?? '-'} - {prediction.predictedAwayScore ?? '-'}</span>
          </div>
          <div>
            <em className={`prediction-status status-${prediction.status.toLowerCase()}`}>{prediction.status}</em>
            {typeof prediction.pointsAwarded === 'number' && <span>{prediction.pointsAwarded} pts</span>}
            {typeof prediction.actualHomeScore === 'number' && typeof prediction.actualAwayScore === 'number' && (
              <span>Final: {prediction.actualHomeScore} - {prediction.actualAwayScore}</span>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

function ResultGroups({ liveResults, upcomingResults, recentResults, settlements }: {
  liveResults: Result[];
  upcomingResults: Result[];
  recentResults: Result[];
  settlements: Result[];
}) {
  return (
    <div className="results-list">
      <ResultGroup title="En vivo" results={liveResults} live />
      <ResultGroup title="Próximos partidos" results={upcomingResults} />
      <ResultGroup title="Últimos resultados" results={recentResults} />
      <ResultGroup title="Partidos liquidados" results={settlements} settled />
    </div>
  );
}

function ResultGroup({ title, results, live = false, settled = false }: { title: string; results: Result[]; live?: boolean; settled?: boolean }) {
  if (results.length === 0) return null;

  return (
    <div className="results-group">
      <h3>{title}</h3>
      <ul>
        {results.map((result) => (
          <li key={result.id} className="result-item">
            <div>
              <strong>{result.home}</strong>
              {typeof result.homeScore === 'number' && typeof result.awayScore === 'number'
                ? <> {result.homeScore} - {result.awayScore} </>
                : ' vs '}
              <strong>{result.away}</strong>
            </div>
            <div className="result-meta">
              <span>{result.league ?? 'Sin liga'}</span>
              <span className={live ? 'result-status-live' : ''}>{settled ? 'Liquidado' : result.status}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default App;
