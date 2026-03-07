import React, { useState } from 'react';

export default function SettingsModal({ settings, onSave, onClose }) {
    const [draft, setDraft] = useState({
        studyDurationSec: settings.studyDurationSec,
        breakDurationSec: settings.breakDurationSec,
        autoSwitch: settings.autoSwitch
    });

    const handleSave = () => {
        onSave(draft);
    };

    return (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-neutral-900 border border-white/10 p-6 rounded-2xl shadow-2xl w-full max-w-sm">
                <h2 className="text-xl font-bold text-white mb-4">Impostazioni Stanza</h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-1">
                            Durata Studio (minuti)
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="120"
                            value={draft.studyDurationSec / 60}
                            onChange={(e) => setDraft({ ...draft, studyDurationSec: Number(e.target.value) * 60 })}
                            className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-red-500"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-neutral-400 mb-1">
                            Durata Pausa (minuti)
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="60"
                            value={draft.breakDurationSec / 60}
                            onChange={(e) => setDraft({ ...draft, breakDurationSec: Number(e.target.value) * 60 })}
                            className="w-full bg-black/50 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-red-500"
                        />
                    </div>

                    <div className="flex items-center justify-between pt-2">
                        <label className="text-sm font-medium text-neutral-400">
                            Avvio automatico timer
                        </label>
                        <input
                            type="checkbox"
                            checked={draft.autoSwitch}
                            onChange={(e) => setDraft({ ...draft, autoSwitch: e.target.checked })}
                            className="w-5 h-5 accent-red-500 rounded bg-black/50 border-white/10 focus:ring-red-500"
                        />
                    </div>
                </div>

                <div className="mt-6 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors font-medium"
                    >
                        Annulla
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors font-medium shadow-lg"
                    >
                        Salva
                    </button>
                </div>
            </div>
        </div>
    );
}