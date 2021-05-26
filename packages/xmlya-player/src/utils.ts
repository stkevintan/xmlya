import { debounce, throttle } from 'throttle-debounce-ts';

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
    let wrapped = false;
    onResize();
    function onResize() {
        if (checkWrapped() !== wrapped) {
            wrapped = !wrapped;
            node.dispatchEvent(new CustomEvent('flexWrapChanged', { detail: { wrapped } }));
        }
    }
    function checkWrapped(): boolean {
        const firstChild = node.firstElementChild as HTMLElement;
        const lastChild = node.lastElementChild as HTMLElement;
        if (firstChild === lastChild) {
            return true;
        }

        return node.offsetHeight >= firstChild.offsetHeight + lastChild.offsetHeight;
    }
    const onResizeThrottled = throttle({ trailing: true, delay: 500 }, onResize);
    window.addEventListener('resize', onResizeThrottled);
    return {
        update: onResize,
        destroy: () => window.removeEventListener('resize', onResizeThrottled),
    };
}
