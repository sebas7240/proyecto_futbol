import * as fileStore from './fileDataStore.js';
import * as firestoreStore from './firestoreDataStore.js';

const store = process.env.DATA_STORE === 'file' ? fileStore : firestoreStore;

export const publicUser = store.publicUser;
export const buildUserFromFirebase = store.buildUserFromFirebase;
export const ensureUser = store.ensureUser;
export const updateUserWallet = store.updateUserWallet;
export const listUsers = store.listUsers;
export const listRanking = store.listRanking;
export const listStoredMatches = store.listStoredMatches;
export const listStoredMatchesByDate = store.listStoredMatchesByDate;
export const getStoredMatchById = store.getStoredMatchById;
export const upsertMatches = store.upsertMatches;
export const listPredictions = store.listPredictions;
export const listUserPredictions = store.listUserPredictions;
export const createExactScorePrediction = store.createExactScorePrediction;
export const countTodayPredictions = store.countTodayPredictions;
export const listSettledResults = store.listSettledResults;
export const settleExactScorePredictions = store.settleExactScorePredictions;
