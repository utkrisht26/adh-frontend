export const ACTIVE_RUN_STATUSES = ['discovering', 'awaiting_approval', 'acquiring', 'building'];
export const TERMINAL_RUN_STATUSES = ['succeeded', 'failed', 'cancelled'];

export function formatCost(value: number | null | undefined): string {
  return value == null ? 'unknown' : `$${value.toFixed(2)}`;
}

export function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString(undefined, {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function downloadFile(name: string, data: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
