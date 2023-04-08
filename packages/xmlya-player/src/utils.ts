import { throttle } from 'throttle-debounce-ts';

let cache: any = null;

export function getVscode() {
    if (cache) return cache;
    return (cache = (window as any).acquireVsCodeApi());
}

export function formatTimestamp(sec: number | undefined): string {
    if (sec === undefined) return '--:--';
    const segArr: number[] = [];
    // s, m, h
    for (let i = 0; i < 3; i++) {
        segArr.push(sec % 60);
        sec = Math.floor(sec / 60);
    }

    const s = `${100 + segArr[0]}`.substr(1);
    const m = `${100 + segArr[1]}`.substr(1);
    const h = segArr[2];

    return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`;
}

export function flexWrapWatcher(node: HTMLDivElement) {
    let wrapped: boolean | undefined = undefined;
    const onResize = () => {
        const checked = checkWrapped();
        if (checked !== wrapped) {
            wrapped = checked;
            node.dispatchEvent(new CustomEvent('flexWrapChanged', { detail: { wrapped } }));
        }
    };
    onResize();
    const onResizeThrottled = throttle({ trailing: true, delay: 500 }, onResize);
    window.addEventListener('resize', onResizeThrottled);
    return {
        update: onResize,
        destroy: () => window.removeEventListener('resize', onResizeThrottled),
    };

    function checkWrapped(): boolean {
        const firstChild = node.firstElementChild as HTMLElement;
        const lastChild = node.lastElementChild as HTMLElement;
        if (firstChild === lastChild) {
            return true;
        }

        return node.offsetHeight >= firstChild.offsetHeight + lastChild.offsetHeight;
    }
}

export function textOverflowWatcher(node: HTMLDivElement) {
    let overflowed: boolean | undefined = undefined;
    const span = node.firstElementChild as HTMLSpanElement;
    if (!span) {
        return {};
    }
    const onResize = () =>  {
        const checked = isOverflowing();
        if (checked !== overflowed) {
            overflowed = checked;
            if (overflowed) {
                span.classList.add('text-overflowed');
            } else {
                span.classList.remove('text-overflowed');
            }
        }
    };
    const onResizeThrottled = throttle({ trailing: true, delay: 500 }, onResize);
    const obs = new ResizeObserver(onResizeThrottled);
    obs.observe(node);
    onResize();
    return {
        update: onResize,
        destroy: () => obs.unobserve(node),
    };
    // https://developer.mozilla.org/en-US/docs/Web/API/Element/scrollWidth#example
    function isOverflowing(): boolean {
        return node.scrollWidth > node.offsetWidth;
    }
}
