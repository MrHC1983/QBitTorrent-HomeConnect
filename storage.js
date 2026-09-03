export const DEFAULTS = {
  host: '',
  ssl: false,
  apiKey: '',
  refreshSeconds: 1,
  autoStartAdded: true,
  theme: 'dark'
};
export async function loadConfig() {
  const data = await chrome.storage.local.get(DEFAULTS);
  return {...DEFAULTS, ...data};
}
export async function saveConfig(values) {
  await chrome.storage.local.set({
    host: String(values.host || '').trim(),
    ssl: Boolean(values.ssl),
    apiKey: String(values.apiKey || '').trim(),
    refreshSeconds: Math.max(1, Math.min(30, Number(values.refreshSeconds) || 1)),
    autoStartAdded: values.autoStartAdded !== false,
    theme: values.theme === 'light' ? 'light' : 'dark'
  });
}


const DEFAULT_COLUMN_WIDTHS = [3.5, 31, 8.5, 15, 12, 7, 9, 9, 5];
export async function loadColumnWidths() {
  const {columnWidths} = await chrome.storage.local.get({columnWidths: DEFAULT_COLUMN_WIDTHS});
  return Array.isArray(columnWidths) && columnWidths.length === DEFAULT_COLUMN_WIDTHS.length
    ? columnWidths
    : [...DEFAULT_COLUMN_WIDTHS];
}
export async function saveColumnWidths(widths) {
  await chrome.storage.local.set({columnWidths: widths});
}
