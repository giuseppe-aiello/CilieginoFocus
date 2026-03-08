import React from 'react';

export default function StudyHeatmap({ dailyData = {} }) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const monthName = new Intl.DateTimeFormat('it-IT', { month: 'long' }).format(now);
    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0=Dom, 1=Lun...
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days = [];

    // Celle vuote per i giorni prima dell'inizio del mese
    for (let i = 0; i < firstDayOfMonth; i++) {
        days.push({ empty: true });
    }

    // Giorni del mese
    // Giorni del mese
    for (let d = 1; d <= daysInMonth; d++) {
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

        const rawData = dailyData[dateKey];

        // Se rawData è un numero usa la vecchia logica, se è un oggetto usa la nuova, altrimenti 0
        const daySeconds = typeof rawData === 'number' ? rawData : (rawData?.seconds || 0);
        const dayCount = typeof rawData === 'number' ? (rawData > 0 ? 1 : 0) : (rawData?.count || 0);

        days.push({
            day: d,
            seconds: daySeconds,
            pomodoros: dayCount,
            empty: false
        });
    }

    const getColor = (seconds) => {
        if (seconds === 0) return 'bg-white/5 border-white/10';
        const hours = seconds / 3600;
        if (hours < 1) return 'bg-red-900/40 border-red-900/50';
        if (hours < 3) return 'bg-red-800/60 border-red-700/60';
        if (hours < 5) return 'bg-red-600 border-red-500';
        return 'bg-red-500 border-red-300 shadow-[0_0_10px_rgba(239,68,68,0.5)]';
    };

    return (
        <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
            <h3 className="text-neutral-400 font-bold uppercase tracking-widest text-xs mb-4 flex justify-between">
                <span>Impegno Mensile</span>
                <span className="text-red-500">{monthName} {year}</span>
            </h3>

            <div className="grid grid-cols-7 gap-2 text-center mb-2">
                {['D', 'L', 'M', 'M', 'G', 'V', 'S'].map(d => (
                    <span key={d} className="text-[10px] text-neutral-600 font-bold">{d}</span>
                ))}
            </div>


            <div className="grid grid-cols-7 gap-2">
                {days.map((item, idx) => {
                    const col = idx % 7;

                    let tooltipPosition = 'left-1/2 -translate-x-1/2 items-center';
                    let trianglePosition = '';

                    if (col === 0) {
                        tooltipPosition = 'left-0 items-start';
                        trianglePosition = 'ml-4';
                    } else if (col === 1) {
                        tooltipPosition = '-left-8 items-start';
                        trianglePosition = 'ml-12';
                    } else if (col === 5) {
                        tooltipPosition = '-right-8 items-end';
                        trianglePosition = 'mr-12';
                    } else if (col === 6) {
                        tooltipPosition = 'right-0 items-end';
                        trianglePosition = 'mr-4';
                    }

                    return (
                        <div
                            key={idx}
                            className={`relative group aspect-square rounded-lg border transition-all flex items-center justify-center text-[10px] font-bold
                    ${item.empty ? 'border-transparent' : getColor(item.seconds)}
                    ${!item.empty && item.seconds > 0 ? 'text-white' : 'text-neutral-700'}
                `}
                        >
                            {!item.empty && item.day}

                            {!item.empty && (
                                <div className={`absolute bottom-full mb-2 flex w-max flex-col z-50 pointer-events-none 
                        transition-all duration-200 ease-out opacity-0 invisible translate-y-2 
                        group-hover:opacity-100 group-hover:visible group-hover:translate-y-0 
                        ${tooltipPosition}`}
                                >
                                    <span className="relative z-10 p-2 text-xs leading-none text-white bg-neutral-900 rounded-lg shadow-xl border border-white/20 whitespace-nowrap">
                                        {item.pomodoros} pomodor{item.pomodoros === 1 ? 'o' : 'i'} completat{item.pomodoros === 1 ? 'o' : 'i'} ed un totale di {Math.floor(item.seconds / 60)} minut{Math.floor(item.seconds / 60) === 1 ? 'o' : 'i'}
                                    </span>

                                    <div className={`w-3 h-3 -mt-2 rotate-45 bg-neutral-900 border-r border-b border-white/20 ${trianglePosition}`}></div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>


            <div className="mt-4 flex items-center justify-between text-[10px] text-neutral-500 border-t border-white/5 pt-3">
                <span>0h</span>
                <div className="flex gap-1">
                    {[0, 1, 3, 5, 8].map(h => (
                        <div key={h} className={`w-3 h-3 rounded-sm border ${getColor(h * 3600)}`}></div>
                    ))}
                </div>
                <span>5h+</span>
            </div>
        </div>
    );
}