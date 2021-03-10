<script>
    import outer from './statics/disk-outer.png';
    import handlerEnd from './statics/disk-handler-end.png';
    import handler from './statics/disk-handler.png';
    import inner from './statics/disk-inner.png';
    import emptyDisk from './statics/empty-disk.jpeg';

    export let cover = emptyDisk;
    export let playing = false;
</script>

<div
    style="
    --outer-url: url({outer});
    --handler-end-url: url({handlerEnd});
    --handler-url: url({handler});
    --cover-url: url({cover || emptyDisk}); 
    --inner-url: url({inner});
    --outer-size: 180px;
    --inner-size: calc(var(--outer-size) / 180 * 118.4);
    "
    class="cover-root"
>
    <div class="cover-container" class:playing>
        <i class="handler" />
        <div class="cover" />
    </div>
</div>

<style lang="less">
    .cover-container {
        display: flex;
        align-items: center;
        justify-content: center;
        background-image: var(--outer-url);
        position: relative;
        background-size: 100%;
        width: var(--outer-size);
        height: var(--outer-size);
        background-position: center;
        background-repeat: no-repeat;
        &:before {
            content: '';
            position: absolute;
            right: 0;
            top: 0;
            width: 18px;
            height: 18px;
            background: var(--handler-end-url) center no-repeat;
        }
        // &:after {
        //     // content: '';
        //     position: absolute;
        //     top: 50%;
        //     left: 50%;
        //     transform: translate(-50%, -50%);
        //     width: 24px;
        //     height: 24px;
        //     background: var(--inner-url) center no-repeat;
        //     background-size: 100%;
        // }
        i {
            position: absolute;
            right: 7px;
            top: 10px;
            display: block;
            width: calc(var(--outer-size) / 10.9);
            height: calc(var(--outer-size) / 2.7);
            background: var(--handler-url) center no-repeat;
            background-size: 100%;
            transition: all 0.3s;
            transform-origin: top;
            transform: rotateZ(-20deg);
        }

        .cover {
            width: var(--inner-size);
            height: var(--inner-size);
            border-radius: 50%;
            background: #fd5b5b center no-repeat;
            background-image: var(--cover-url);
            background-size: 100%;
            animation: rotate 7s linear infinite;
            animation-play-state: paused;
        }

        &.playing {
            i {
                transform: none;
            }
            .cover {
                animation-play-state: running;
            }
        }
    }

    @keyframes rotate {
        from {
            transform: rotate(0deg);
        }
        to {
            transform: rotate(360deg);
        }
    }
    .cover-root {
        position: relative;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        flex: 1 0 auto;
    }
</style>
