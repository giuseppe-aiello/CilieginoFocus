export const getMascotStage = (timeLeft, totalDuration, mode) => {
    if (mode === 'break') {
        return 'relaxing'; // Stato fisso durante le pause
    }

    if (totalDuration === 0) return 'fresh'; // Previene divisioni per zero

    // Calcola la percentuale di tempo trascorso (da 0 a 100)
    const progressPercentage = ((totalDuration - timeLeft) / totalDuration) * 100;

    if (progressPercentage < 25) {
        return 'fresh'; // Appena iniziato: mascotte energica
    } else if (progressPercentage < 75) {
        return 'focused'; // Fase centrale: mascotte concentrata
    } else if (progressPercentage < 95) {
        return 'tired'; // Ultime fasi: mascotte affaticata/sudata
    } else {
        return 'almost_done'; // Ultimi secondi: mascotte in trepidazione
    }
};