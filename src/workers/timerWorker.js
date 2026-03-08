let timerId = null;

// Rimane in ascolto dei messaggi inviati da React (Main Thread)
self.onmessage = function (e) {
    const { command, targetEndTime } = e.data;

    if (command === 'start') {
        // Pulisce eventuali timer precedenti per sicurezza
        if (timerId) clearInterval(timerId);

        const target = new Date(targetEndTime).getTime();

        // Avvia un timer nativo che non verrà bloccato dal browser
        timerId = setInterval(() => {
            const now = Date.now();
            const remaining = Math.max(0, Math.ceil((target - now) / 1000));

            if (remaining <= 0) {
                clearInterval(timerId);
                // Segnala a React che il tempo è scaduto
                self.postMessage({ type: 'finished' });
            } else {
                // Invia a React i secondi aggiornati da mostrare a schermo
                self.postMessage({ type: 'tick', remaining });
            }
        }, 1000);
    }

    if (command === 'stop') {
        // Mette in pausa il conteggio in background
        if (timerId) clearInterval(timerId);
    }
};