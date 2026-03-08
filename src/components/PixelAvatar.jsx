import React from 'react';
import { PIXEL_FRUITS, COLOR_MAP } from '../utils/pixelArt';

export default function PixelAvatar({ type, size = "w-12" }) {
    const pixels = PIXEL_FRUITS[type] || PIXEL_FRUITS.ciliegie;

    return (
        <div
            className={`${size} aspect-square grid grid-cols-10 gap-px`}
        >
            {pixels.flat().map((colorIdx, i) => (
                <div
                    key={i}
                    style={{ backgroundColor: COLOR_MAP[colorIdx] }}
                    className="w-full h-full rounded-[1px]"
                />
            ))}
        </div>
    );
}