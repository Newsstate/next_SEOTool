// lib/format.ts
export function cn(...a: Array<string | false | undefined | null>) {
  return a.filter(Boolean).join(" ");
}

export async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
