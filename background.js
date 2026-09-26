// Service worker: turns task reminders and focus sessions into notifications,
// even when no Inspira tab is open. Reads the same storage the page writes.

const DATA_KEY = 'inspira.data.v2';
const DEVICE_KEY = 'inspira.device.v2';
const TASK_PREFIX = 'task:';

async function hasNotifications() {
  return chrome.permissions.contains({ permissions: ['notifications'] });
}

async function rescheduleReminders() {
  const { [DATA_KEY]: data } = await chrome.storage.local.get(DATA_KEY);
  const existing = (await chrome.alarms.getAll()).filter((a) => a.name.startsWith(TASK_PREFIX));
  const now = Date.now();
  const wanted = new Map();
  for (const t of Object.values(data?.tasks || {})) {
    if (t.reminder && t.reminder > now && !t.done && !t.deleted) wanted.set(TASK_PREFIX + t.id, t.reminder);
  }
  for (const alarm of existing) {
    const when = wanted.get(alarm.name);
    if (when === undefined || Math.abs(alarm.scheduledTime - when) > 1000) await chrome.alarms.clear(alarm.name);
    else wanted.delete(alarm.name);
  }
  for (const [name, when] of wanted) chrome.alarms.create(name, { when });
}

chrome.runtime.onInstalled.addListener(rescheduleReminders);
chrome.runtime.onStartup.addListener(rescheduleReminders);
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes[DATA_KEY]) rescheduleReminders();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!(await hasNotifications())) return;

  if (alarm.name === 'focus-end') {
    const { [DEVICE_KEY]: device } = await chrome.storage.local.get(DEVICE_KEY);
    const focus = device?.focus;
    if (!focus || focus.state !== 'running') return;
    chrome.notifications.create('focus-end', {
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: 'Focus session complete',
      message: focus.intention ? `“${focus.intention}” — take a breath.` : 'Nicely done. Take a breath.',
      priority: 1,
    });
    return;
  }

  if (alarm.name.startsWith(TASK_PREFIX)) {
    const id = alarm.name.slice(TASK_PREFIX.length);
    const { [DATA_KEY]: data } = await chrome.storage.local.get(DATA_KEY);
    const task = data?.tasks?.[id];
    if (!task || task.done || task.deleted) return;
    chrome.notifications.create(alarm.name, {
      type: 'basic',
      iconUrl: 'icons/icon-128.png',
      title: 'Reminder',
      message: task.title,
      priority: 1,
    });
  }
});

chrome.notifications?.onClicked.addListener((id) => {
  chrome.notifications.clear(id);
  chrome.tabs.create({});
});
