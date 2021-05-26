<script lang="ts">
    import Title from './Title.svelte';
    import Progress from './Progress.svelte';
    import { onMount } from 'svelte';
    import { getVscode } from './utils';
    import emptyDisk from './statics/logo_full.svg';

    interface IState {
        total: number;
        album: string;
        title: string;
        cover: string;
        playing: boolean;
    }

    let state: Partial<IState> = {};
    let position: number = 0;

    onMount(() => {
        const onMessage = (event: MessageEvent<{ type: string; payload?: any }>) => {
            const msg = event.data;
            if (!msg || !msg.type) return;
            switch (msg.type) {
                case 'updateState':
                    state = { ...state, ...msg.payload };
                    break;
                case 'setState':
                    state = { ...msg.payload };
                    break;
                case 'setPosition':
                    position = msg.payload;
                    break;
                case 'clearState':
                    state = {};
                    position = 0;
                    break;
            }
        };
        window.addEventListener('message', onMessage);
        const vscode = getVscode();
        vscode.postMessage({ type: 'watch-state' });

        return () => window.removeEventListener('message', onMessage);
    });
    // we must add position to the condition or body, so that svelte can detect the change of position.
    $: if (state.playing && position !== -1) {
        getVscode().postMessage({ type: 'sync-pos' });
    }

</script>

<main style="--background-url: url({state.cover});--cover-url: url({state.cover ?? emptyDisk});">
    <div class="content">
        <div class="control-field">
            <Title title={state.title} album={state.album} playing={state.playing} />
            <Progress max={state.total} value={position ?? 0} />
        </div>
    </div>
</main>

<style lang="less">
    main {
        width: 100vw;
        height: 100vh;
        background-size: cover;
        background-attachment: fixed;
        background-position: center;
        background-image: var(--background-url);
        background-color: #fff;
    }
    .content {
        width: 100%;
        height: 100%;
        overflow: auto;
        display: flex;
        padding: 12px 24px;
        flex-flow: row nowrap;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(5px);
        background: rgba(12, 14, 23, 84%);
    }
    .control-field {
        padding: 10px;
        max-width: 700px;
        flex: 1 1 auto;
    }

</style>
