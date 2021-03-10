<script lang="ts">
    import Cover from './Cover.svelte';
    import Title from './Title.svelte';
    import Progress from './Progress.svelte';
    import { onMount } from 'svelte';
    import { getVscode } from './vscode';

    interface IState {
        currentPos: number;
        total: number;
        album: string;
        title: string;
        cover: string;
        playing: boolean;
    }

    let state: Partial<IState> = {};

    onMount(() => {
        const onMessage = (event: MessageEvent<{ type: string; payload?: any }>) => {
            const msg = event.data;
            console.log(msg);
            if (!msg || !msg.type) return;
            switch (msg.type) {
                case 'setState':
                    state = { ...state, ...msg.payload };
                    break;
                case 'clear':
                    state = {};
                    break;
            }
        };
        window.addEventListener('message', onMessage);
        getVscode().postMessage({ type: 'pollState' });
        return () => window.removeEventListener('message', onMessage);
    });
</script>

<main>
    <Cover cover={state.cover} playing={state.playing} />
    <div class="control-field">
        <Title title={state.title} album={state.album} />
        <Progress max={state.total} value={state.currentPos ?? 0} />
    </div>
</main>

<style lang="less">
    main {
        // font-family: sans-serif;
        width: 100vw;
        height: 100vh;
        overflow: auto;
        display: flex;
        padding: 12px 0;
        flex-flow: column nowrap;
        align-items: center;
        justify-content: start;
    }
    .control-field {
        padding: 10px;
        width: 100%;
        flex: 0 1 auto;
    }
</style>
