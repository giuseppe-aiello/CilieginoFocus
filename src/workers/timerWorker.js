let timerId = null;

self.onmessage = function (e) {
    const { command, targetEndTime } = e.data;

    if (command === 'start') {
        if (timerId) clearInterval(timerId);

        const target = new Date(targetEndTime).getTime();

        // 1. Isoliamo la logica di calcolo in una funzione
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

        // 2. Eseguiamo il primissimo scatto all'istante (0ms di ritardo)
        tick();

        // 3. Affidiamo i successivi scatti al ciclo di 1 secondo
        timerId = setInterval(tick, 1000);
    }

    if (command === 'stop') {
        if (timerId) clearInterval(timerId);
    }
};