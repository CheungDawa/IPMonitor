/**
 * 格式化时间字符串为标准的本地友好格式 (YYYY-MM-DD HH:mm:ss)
 */
export function formatDateTime(val?: string | null): string {
  if (!val) return '-';
  const clean = val.replace('T', ' ').replace('Z', '').split('.')[0].trim();
  if (clean.length >= 19) {
    return clean.substring(0, 19);
  }
  return clean;
}

/**
 * 格式化仅时间部分 (HH:mm:ss)
 */
export function formatTimeOnly(val?: string | null): string {
  if (!val) return '-';
  const full = formatDateTime(val);
  if (full.includes(' ')) {
    return full.split(' ')[1];
  }
  return full;
}
