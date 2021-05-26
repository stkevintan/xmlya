<script lang="ts">
    import { formatTimestamp, getVscode } from './utils';
    export let max: number | undefined = undefined;
    export let value: number = 0;
    $: computedValue = max === undefined || max < value ? undefined : value;
    $: percent = max && computedValue ? (computedValue * 100) / max : 0;
    function onChange(e: Event) {
        const valStr = (e.target as HTMLInputElement)?.value;
        if (valStr) value = parseInt(valStr, 10);
        getVscode().postMessage({
            type: 'update-progress',
            payload: { value },
        });
    }

</script>

<div class="container">
    <span class="position time">{formatTimestamp(computedValue)}</span>
    <div class="progress">
        <span class="slider-bar" style="width: {percent}%" />
        <input
            type="range"
            class="range-slider"
            min="0"
            max={max || 0}
            value={computedValue || 0}
            on:change={onChange}
        />
    </div>
    <span class="total time">{formatTimestamp(max)}</span>
</div>

<style lang="less">
    @width: 3px;

    .container {
        display: flex;
        align-items: center;
        .time {
            flex: 0 0 auto;
            display: block;
            color: #a3a3ac;
        }
    }
    .progress {
        position: relative;
        width: 100%;
        margin: 0 15px;
        flex: 1 1 auto;
        .range-slider {
            display: block;
            -webkit-appearance: none;
            appearance: none;
            background: #a3a3ac;
            width: 100%;
            border-radius: (@width / 2);
            margin: 0;
            height: @width;
            cursor: pointer;
            transition: all ease-in 0.25s;
        }

        .range-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            border-radius: 50%;
            border: 0;
            position: relative;
            width: 8px;
            height: 8px;
            z-index: 1000;
            background-color: #fff;
        }

        .range-slider {
            &:focus {
                outline: none;
            }

            &:hover,
            &:active {
                &::-webkit-slider-thumb {
                    top: 0px;
                }
            }
        }

        ::-moz-range-track {
            background: transparent;
            border: 0;
        }
        input::-moz-focus-inner,
        input::-moz-focus-outer {
            border: 0;
        }

        .slider-bar {
            position: absolute;
            height: @width;
            border-top-left-radius: (@width / 2);
            border-bottom-left-radius: (@width / 2);
            background: #426cf8;
            left: 0;
            bottom: 0;
            pointer-events: none;
        }
    }

</style>
