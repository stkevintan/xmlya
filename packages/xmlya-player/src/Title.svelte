<script>
    import { flexWrapWatcher } from './utils';
    let wrapped = false;
    export let title = '';
    export let album = '';
    export let playing = false;
    function onFlexWrapChanged(e) {
        wrapped = e.detail.wrapped;
    }

</script>

<div
    class="container"
    class:playing
    class:empty={title === undefined}
    class:compact={wrapped}
    on:flexWrapChanged={onFlexWrapChanged}
    use:flexWrapWatcher={title}
>
    <div class="cover" />
    {#if title}
        <div class="title">
            <h1 class="ellipsis">{title || ''}</h1>
            {#if album}
                <author class="ellipsis">{album}</author>
            {/if}
        </div>
    {/if}
</div>

<style lang="less">
    @keyframes rotate {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }
    .container {
        @size: 120px;
        display: flex;
        flex-flow: row wrap;
        align-items: center;
        margin-bottom: 12px;
        .cover {
            flex: 0 0 auto;
            background-image: var(--cover-url);
            background-repeat: no-repeat;
            background-size: cover;
            background-position: center;
            height: @size;
            width: @size;
            border-radius: 50%;
            margin-right: 20px;
            animation: rotate 7s linear infinite;
            animation-play-state: paused;
            box-shadow: 0px 3px 5px -1px rgba(0, 0, 0, 20%), 0px 6px 10px 0px rgba(0, 0, 0, 14%),
                0px 1px 18px 0px rgba(0, 0, 0, 12%);
        }

        &.empty {
            .cover {
                animation: none;
            }
        }
        &.playing {
            .cover {
                animation-play-state: running;
            }
        }
        &.compact {
            .cover {
                @size: 140px;
                height: @size;
                width: @size;
                margin-bottom: 12px;
            }
            justify-content: center;
            text-align: center;
        }
    }

    .ellipsis {
        text-overflow: ellipsis;
        overflow: hidden;
        white-space: nowrap;
    }
    .title {
        line-height: 20px;
        h1 {
            margin: 0 0 3px 0;
            font-weight: normal;
            font-size: 18px;
        }
        author {
            color: #c3c3c3;
            display: block;
            margin: 0;
            font-weight: normal;
            font-size: 12px;
        }
    }

</style>
