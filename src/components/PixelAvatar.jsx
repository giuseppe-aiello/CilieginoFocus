import React from 'react';
import { PIXEL_FRUITS, COLOR_MAP } from '../utils/pixelArt';

export default function PixelAvatar({ type, size = "w-12" }) {
    const pixels = PIXEL_FRUITS[type] || PIXEL_FRUITS.ciliegie;

    return (
        <div
            className={`${size} grid grid-cols-9 gap-px`}
            style={{
                aspectRatio: '9 / 10',
                height: 'auto'
            }}
        >
            {pixels.flat().map((colorIdx, i) => (
                <div
                    key={i}
                    style={{ backgroundColor: COLOR_MAP[colorIdx] }}
                    className="rounded-[1px]"
                />
            ))}
        </div>
    );
}