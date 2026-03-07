import React from 'react';

export default function Navbar({ session, onLogout }) {
    if (!session || !session.user) return null;

    return (
        <nav className="bg-black/40 backdrop-blur-lg border-b border-white/10 p-3 sm:p-4 sticky top-0 z-50">
            <div className="max-w-4xl mx-auto flex flex-row justify-between items-center gap-2 sm:gap-4 w-full">

                {/* Sinistra: Logo e Nome App */}
                <h1 className="text-base sm:text-2xl font-bold tracking-tight sm:tracking-wider flex items-center gap-1 sm:gap-2 drop-shadow-lg text-white whitespace-nowrap shrink-0">
                    🍒 CilieginoFocus
                </h1>

                {/* Destra: Utente e Bottone Esci */}
                <div className="flex items-center gap-2 sm:gap-4 justify-end min-w-0">
                    <div className="text-[10px] sm:text-sm bg-white/10 border border-white/20 backdrop-blur-md px-2 py-1 sm:px-4 sm:py-1.5 rounded-full font-medium shadow-inner truncate min-w-0">
                        {session.user.email}
                    </div>
                    <button
                        onClick={onLogout}
                        className="text-xs sm:text-sm text-red-400 hover:text-red-300 hover:underline font-semibold transition-colors shrink-0 whitespace-nowrap"
                    >
                        Esci
                    </button>
                </div>

            </div>
        </nav>
    );
}