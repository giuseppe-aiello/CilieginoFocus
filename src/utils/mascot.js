export const getMascotStage = (roomSeconds) => {
    const xp = Math.floor(roomSeconds / 60);

    const stages = [
        { minXp: 0, name: 'Seme Dormiente', visual: '🟤', color: 'text-amber-700' },
        { minXp: 50, name: 'Germoglio', visual: '🌱', color: 'text-emerald-400' },
        { minXp: 150, name: 'Piantina', visual: '🌿', color: 'text-emerald-500' },
        { minXp: 300, name: 'Pomodorino Verde', visual: '🍏', color: 'text-lime-400' },
        { minXp: 600, name: 'Ciliegino Rosso', visual: '🍅', color: 'text-red-500' },
        { minXp: 1000, name: 'Re Supremo', visual: '👑', color: 'text-yellow-400' }
    ];

    let currentStageIndex = 0;
    for (let i = 0; i < stages.length; i++) {
        if (xp >= stages[i].minXp) {
            currentStageIndex = i;
        }
    }

    const stage = stages[currentStageIndex];
    const isMaxLevel = currentStageIndex === stages.length - 1;
    const nextStage = isMaxLevel ? stage : stages[currentStageIndex + 1];

    const level = Math.floor(xp / 25) + 1;

    let progress = 100;
    let xpNeeded = 0;

    if (!isMaxLevel) {
        const xpInCurrentStage = xp - stage.minXp;
        xpNeeded = nextStage.minXp - stage.minXp;
        progress = (xpInCurrentStage / xpNeeded) * 100;
    }

    return {
        ...stage,
        level,
        xp,
        nextXp: isMaxLevel ? 'MAX' : nextStage.minXp,
        progress: Math.min(100, Math.max(0, progress)),
        isMaxLevel
    };
};