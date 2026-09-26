// Single app store. Three slices:
//   data   — synced across devices (tasks, notes, projects, prefs)
//   device — this browser only (mode, location, weather cache, focus session, account)
//   ui     — ephemeral view state (selected date, open panels, fetched events)

import * as storage from '../services/storage.js';
import { uid } from './ids.js';
import { todayKey } from './dates.js';
import { mergeData, fingerprint } from './merge.js';

export const DATA_KEY = 'inspira.data.v2';
export const DEVICE_KEY = 'inspira.device.v2';

export const DEFAULT_PREFS = {
  theme: 'system', // system | light | dark
  clock24: false,
  showSeconds: false,
  quoteCategory: 'motivation',
  showRail: true,
  showQuoteOnClock: true,
  units: 'c',
  name: '',
  focusMinutes: 25,
  weekStart: 1,
  updatedAt: 0,
};

export const DEFAULT_DEVICE = {
  mode: 'clock', // clock | motivation | focus | plan
  location: null, // { lat, lon, name }
  weather: null, // cached forecast
  account: null, // { email, name, givenName, picture }
  calendarConnected: false,
  focus: { state: 'idle', intention: '', taskId: null, minutes: 25, endsAt: null, remainingMs: null },
  quoteShift: { date: null, n: 0 },
  sync: { fileId: null, lastSyncedAt: 0 },
  hintsSeen: false,
};

export const PROJECT_COLORS = ['#c98b6b', '#7f9c8a', '#8a8fc2', '#c2a15a', '#b07fa6', '#6f9bb5', '#a3a37a'];

let data = { tasks: {}, notes: {}, projects: {}, prefs: { ...DEFAULT_PREFS } };
let device = structuredClone(DEFAULT_DEVICE);
export const ui = {
  date: todayKey(),
  view: 'day', // day | projects
  projectId: null,
  openNoteId: null,
  events: {}, // dayKey -> [event]
  calendarStatus: 'idle', // idle | loading | ready | error
  syncStatus: 'off', // off | syncing | idle | error
};

const listeners = new Set();
const changeListeners = new Set();
let emitQueued = false;
const ownRevs = new Set();
let saveTimer = null;

export const getData = () => data;
export const getDevice = () => device;
export const prefs = () => data.prefs;

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Notified on local data edits (used to schedule sync). */
export function onLocalChange(fn) {
  changeListeners.add(fn);
}

function emit() {
  if (emitQueued) return;
  emitQueued = true;
  queueMicrotask(() => {
    emitQueued = false;
    for (const fn of listeners) fn();
  });
}

export function setUI(patch) {
  Object.assign(ui, patch);
  emit();
}

// ---------- persistence ----------

export async function init() {
  const [storedData, storedDevice] = await Promise.all([storage.load(DATA_KEY), storage.load(DEVICE_KEY)]);
  if (storedData) {
    data = {
      tasks: storedData.tasks || {},
      notes: storedData.notes || {},
      projects: storedData.projects || {},
      prefs: { ...DEFAULT_PREFS, ...storedData.prefs },
    };
  }
  if (storedDevice) {
    device = { ...structuredClone(DEFAULT_DEVICE), ...storedDevice };
    device.focus = { ...DEFAULT_DEVICE.focus, ...storedDevice.focus };
  }
  storage.onExternalChange((key, value) => {
    if (!value || ownRevs.has(value._rev)) return;
    if (key === DATA_KEY) {
      // Another tab edited: merge rather than overwrite so unsaved local edits survive.
      data = mergeData(data, value);
      data.prefs = { ...DEFAULT_PREFS, ...data.prefs };
      emit();
    } else if (key === DEVICE_KEY) {
      device = { ...device, ...value };
      emit();
    }
  });
  emit();
}

function newRev() {
  const rev = uid();
  ownRevs.add(rev);
  if (ownRevs.size > 50) ownRevs.delete(ownRevs.values().next().value);
  return rev;
}

function persistData() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    storage.save(DATA_KEY, { ...data, _rev: newRev() });
  }, 120);
}

function persistDevice() {
  storage.save(DEVICE_KEY, { ...device, _rev: newRev() });
}

function commitData() {
  persistData();
  emit();
  for (const fn of changeListeners) fn();
}

export function setDevice(patch) {
  device = { ...device, ...patch };
  persistDevice();
  emit();
}

export function setPrefs(patch) {
  data.prefs = { ...data.prefs, ...patch, updatedAt: Date.now() };
  commitData();
}

/** Replace data with a merge of local + remote. Returns true if local changed. */
export function applyRemote(remote) {
  const before = fingerprint(data);
  const merged = mergeData(data, remote);
  merged.prefs = { ...DEFAULT_PREFS, ...merged.prefs };
  const changed = fingerprint(merged) !== before;
  if (changed) {
    data = merged;
    persistData();
    emit();
  }
  return changed;
}

/** Plain snapshot for export / upload (without tombstone-free filtering). */
export function snapshot() {
  return { tasks: data.tasks, notes: data.notes, projects: data.projects, prefs: data.prefs };
}

// ---------- tasks ----------

export function addTask(fields) {
  const now = Date.now();
  const task = {
    id: uid(),
    title: '',
    date: ui.date,
    time: null,
    priority: 0,
    projectId: null,
    reminder: null,
    done: false,
    doneAt: null,
    createdAt: now,
    updatedAt: now,
    deleted: false,
    ...fields,
  };
  data.tasks = { ...data.tasks, [task.id]: task };
  commitData();
  return task;
}

export function updateTask(id, patch) {
  const t = data.tasks[id];
  if (!t) return;
  data.tasks = { ...data.tasks, [id]: { ...t, ...patch, updatedAt: Date.now() } };
  commitData();
}

export function toggleTask(id) {
  const t = data.tasks[id];
  if (!t) return;
  updateTask(id, { done: !t.done, doneAt: t.done ? null : Date.now() });
}

export function deleteTask(id) {
  updateTask(id, { deleted: true });
}

// ---------- notes ----------

export function addNote(fields) {
  const now = Date.now();
  const note = {
    id: uid(),
    title: '',
    body: '',
    date: ui.date,
    projectId: null,
    createdAt: now,
    updatedAt: now,
    deleted: false,
    ...fields,
  };
  data.notes = { ...data.notes, [note.id]: note };
  commitData();
  return note;
}

export function updateNote(id, patch) {
  const n = data.notes[id];
  if (!n) return;
  data.notes = { ...data.notes, [id]: { ...n, ...patch, updatedAt: Date.now() } };
  commitData();
}

export function deleteNote(id) {
  updateNote(id, { deleted: true });
}

// ---------- projects ----------

export function addProject(name) {
  const now = Date.now();
  const existing = projectList();
  const project = {
    id: uid(),
    name: name.trim(),
    color: PROJECT_COLORS[existing.length % PROJECT_COLORS.length],
    order: existing.length,
    createdAt: now,
    updatedAt: now,
    deleted: false,
  };
  data.projects = { ...data.projects, [project.id]: project };
  commitData();
  return project;
}

export function updateProject(id, patch) {
  const p = data.projects[id];
  if (!p) return;
  data.projects = { ...data.projects, [id]: { ...p, ...patch, updatedAt: Date.now() } };
  commitData();
}

/** Deleting a project keeps its tasks and notes — they just lose the label. */
export function deleteProject(id) {
  const now = Date.now();
  const tasks = { ...data.tasks };
  for (const t of Object.values(tasks)) if (t.projectId === id) tasks[t.id] = { ...t, projectId: null, updatedAt: now };
  const notes = { ...data.notes };
  for (const n of Object.values(notes)) if (n.projectId === id) notes[n.id] = { ...n, projectId: null, updatedAt: now };
  data = { ...data, tasks, notes, projects: { ...data.projects, [id]: { ...data.projects[id], deleted: true, updatedAt: now } } };
  commitData();
}

export function findOrCreateProject(name) {
  const hit = projectList().find((p) => p.name.toLowerCase() === name.toLowerCase());
  return hit || addProject(name);
}

// ---------- selectors ----------

const live = (coll) => Object.values(coll).filter((r) => !r.deleted);

export function sortTasks(list) {
  const open = list
    .filter((t) => !t.done)
    .sort((a, b) => {
      if (a.time !== b.time) {
        if (!a.time) return 1;
        if (!b.time) return -1;
        return a.time < b.time ? -1 : 1;
      }
      if (a.priority !== b.priority) return b.priority - a.priority;
      return a.createdAt - b.createdAt;
    });
  const done = list.filter((t) => t.done).sort((a, b) => (a.doneAt || 0) - (b.doneAt || 0));
  return [...open, ...done];
}

export const tasksForDate = (key) => sortTasks(live(data.tasks).filter((t) => t.date === key));
export const tasksForProject = (id) => sortTasks(live(data.tasks).filter((t) => t.projectId === id));
export const carriedOver = (today) => sortTasks(live(data.tasks).filter((t) => t.date && t.date < today && !t.done));

const byRecent = (a, b) => b.updatedAt - a.updatedAt;
export const notesForDate = (key) =>
  live(data.notes)
    .filter((n) => n.date === key)
    .sort(byRecent);
export const notesForProject = (id) =>
  live(data.notes)
    .filter((n) => n.projectId === id)
    .sort(byRecent);

export const projectList = () => live(data.projects).sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
export const getProject = (id) => (id && data.projects[id] && !data.projects[id].deleted ? data.projects[id] : null);

/** Set of day keys that have tasks or notes (for calendar dots). */
export function daysWithItems() {
  const days = new Set();
  for (const t of live(data.tasks)) if (t.date) days.add(t.date);
  for (const n of live(data.notes)) if (n.date) days.add(n.date);
  return days;
}
