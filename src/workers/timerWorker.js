let timerId = null;

self.onmessage = function (e) {
    // Riceve i secondi netti (es. 1500), non più il timestamp assoluto
    const { command, remainingSec } = e.data;

    if (command === 'start') {
        if (timerId) clearInterval(timerId);

        // Calcola il target basandosi esclusivamente sull'orologio interno di questo PC
        const target = Date.now() + (remainingSec * 1000);

        const tick = () => {
            const now = Date.now();
            const remaining = Math.max(0, Math.ceil((target - now) / 1000));

            if (remaining <= 0) {
                clearInterval(timerId);
                self.postMessage({ type: 'finished' });
            } else {
                self.postMessage({ type: 'tick', remaining });
            }
        };

        // Attende un secondo esatto per tutti
        timerId = setInterval(tick, 1000);
    }

    if (command === 'stop') {
        if (timerId) clearInterval(timerId);
    }
};