import bcrypt from 'bcryptjs';

export const users = [
  {
    id: 'user-001',
    email: 'demo@polla.local',
    username: 'demo',
    walletAddress: null,
    passwordHash: bcrypt.hashSync('demo123', 10),
    credits: 100,
    points: 10
  }
];

export const matches = [
  {
    id: 'match-001',
    home: 'Real Madrid',
    away: 'Barcelona',
    date: '2026-06-20',
    time: '18:00',
    league: 'LaLiga',
    status: 'SCHEDULED'
  },
  {
    id: 'match-002',
    home: 'Argentina',
    away: 'Brasil',
    date: '2026-06-21',
    time: '20:30',
    league: 'Eliminatorias',
    status: 'SCHEDULED'
  }
];

export const predictions = [];
