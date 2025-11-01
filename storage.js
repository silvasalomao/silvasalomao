const KEY = 'bebidas:estoque:v1';

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { products: [], updatedAt: Date.now() };
    return JSON.parse(raw);
  } catch {
    return { products: [], updatedAt: Date.now() };
  }
}

export function save(data) {
  const payload = { ...data, updatedAt: Date.now() };
  localStorage.setItem(KEY, JSON.stringify(payload));
  return payload;
}

export function exportBackup() {
  const blob = new Blob([localStorage.getItem(KEY) ?? '{"products":[]}'], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `backup-estoque-${new Date().toISOString().slice(0,19)}.json`;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  a.remove();
}

export function importBackup(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (!obj || typeof obj !== 'object' || !Array.isArray(obj.products)) throw new Error('Arquivo inválido');
        localStorage.setItem(KEY, JSON.stringify(obj));
        resolve(obj);
      } catch (e) { reject(e); }
    };
    reader.readAsText(file);
  });
}