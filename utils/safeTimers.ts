// utils/safeTimers.ts

// Run a callback on the next frame after layout
export const nextFrame = (cb: () => void) => {
    requestAnimationFrame(() => requestAnimationFrame(cb));
};

// Frame-based loop. Supports a fixed interval (number) OR a dynamic interval via getter.
export const startFrameLoop = (
    intervalMsOrGetter: number | (() => number),
    action: () => boolean // return false to stop
): () => void => {
    let lastTime = Date.now();
    let rafId: number;

    const getInterval = () =>
        typeof intervalMsOrGetter === 'function' ? intervalMsOrGetter() : intervalMsOrGetter;

    const tick = () => {
        const now = Date.now();
        const interval = Math.max(1, getInterval()); // guard against 0/negatives
        if (now - lastTime >= interval) {
            lastTime = now;
            const keepGoing = action();
            if (!keepGoing) return;
        }
        rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
};
