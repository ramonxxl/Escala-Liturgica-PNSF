import { app, dialog } from "electron";
import { autoUpdater } from "electron-updater";

/**
 * Verifica, baixa e instala atualizacoes automaticamente via GitHub
 * Releases (electron-updater). So roda no app empacotado — em modo dev
 * (npm run dev) nao ha instalador, entao nao faz sentido tentar.
 *
 * O download acontece em segundo plano sem interromper o uso. So quando
 * termina de baixar e que perguntamos se o coordenador quer reiniciar na
 * hora ou deixar pra depois — nunca fechamos o app sozinhos no meio do uso.
 */
export function setupAutoUpdater(): void {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-downloaded", (info) => {
    dialog
      .showMessageBox({
        type: "info",
        title: "Atualização disponível",
        message: `Uma nova versão do EscalaLitúrgica (${info.version}) foi baixada.`,
        detail: "Deseja reiniciar agora para aplicar a atualização, ou prefere fazer isso mais tarde?",
        buttons: ["Reiniciar agora", "Depois"],
        defaultId: 0,
        cancelId: 1
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
  });

  autoUpdater.on("error", (err) => {
    console.error("Erro ao verificar atualizações:", err);
  });

  autoUpdater.checkForUpdates().catch((err) => {
    console.error("Erro ao verificar atualizações:", err);
  });
}
