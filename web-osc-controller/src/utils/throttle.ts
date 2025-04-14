/**
 * Basic throttle function.
 * Ensures the wrapped function is called at most once per `delay` milliseconds.
 * Important: This is a simplified version. For production, a library like lodash.throttle is recommended.
 * 
 * @param func The function to throttle.
 * @param delay The throttle period in milliseconds.
 * @returns A throttled function.
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout | null = null;
    let lastArgs: Parameters<T> | null = null;
    let trailingCallScheduled = false;

    function throttled(this: ThisParameterType<T>, ...args: Parameters<T>) {
        lastArgs = args;
        // If no timeout is active, execute immediately
        if (!timeoutId) {
            func.apply(this, args);
            // Set timeout to prevent execution during the delay
            timeoutId = setTimeout(() => {
                timeoutId = null;
                // If there was a call during the delay, execute it now (trailing call)
                if (trailingCallScheduled) {
                    trailingCallScheduled = false;
                    throttled.apply(this, lastArgs!); 
                }
            }, delay);
        } else {
            // If timeout is active, schedule a trailing call to execute after delay
            trailingCallScheduled = true;
        }
    }

    return throttled;
} 