import { useEffect, useState } from "react";
import type { ParishBranding } from "@escala/data";

// Logo fica salva no banco (tabela settings) junto com os outros dados —
// evitamos localStorage, que nao acompanha backup/restauracao do banco e
// pode se comportar de forma inconsistente entre execucoes do app.
export const MAX_LOGO_BYTES = 500 * 1024;

/** Le um arquivo de imagem como data URL, rejeitando arquivos grandes demais. */
export function readLogoFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_LOGO_BYTES) {
      reject(new Error("Imagem muito grande (máximo 500KB). Use uma logo menor ou mais comprimida."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

export function useParishBranding(): {
  branding: ParishBranding;
  updateName: (name: string) => void;
  updateLogo: (dataUrl: string) => void;
} {
  const [branding, setBranding] = useState<ParishBranding>({ name: "", logo: null });

  useEffect(() => {
    window.api.branding.get().then(setBranding);
  }, []);

  const updateName = (name: string): void => {
    setBranding((prev) => ({ ...prev, name }));
    window.api.branding.setName(name);
  };

  const updateLogo = (dataUrl: string): void => {
    setBranding((prev) => ({ ...prev, logo: dataUrl }));
    window.api.branding.setLogo(dataUrl);
  };

  return { branding, updateName, updateLogo };
}
