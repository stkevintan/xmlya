<script lang="ts">
    import { getVscode } from './vscode';

    export let max: number = 0;
    export let value: number = 0;
    $: percent = (value * 100) / max;

    function onChange() {
        getVscode().postMessage({
            type: 'update-progress',
            payload: { value },
        });
    }
</script>

{#if max > 0}
    <div class="progress-container">
        <span class="slider-bar" style="width: {percent}%" />
        <input type="range" class="range-slider" min="0" {max} bind:value on:change={onChange} />
    </div>
{/if}

<style lang="less">
    // @blue: #3fa4f4;
    @width: 3px;
    .progress-container {
        position: relative;
        width: 100%;
        .range-slider {
            -webkit-appearance: none;
            appearance: none;
            background: #a3a3ac;
            width: 100%;
            border-radius: (@width / 2);
            vertical-align: bottom;
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

        // .range-value {
        //     text-transform: capitalize;
        //     //   float: right;
        //     vertical-align: bottom;
        //     min-width: 30px;
        //     display: inline-block;
        //     text-align: center;
        //     border-radius: 3px;
        //     font-size: 0.9em;
        // }

        .slider-bar {
            position: absolute;
            height: @width;
            border-top-left-radius: (@width / 2);
            border-bottom-left-radius: (@width / 2);
            background: #f86442;
            left: 0;
            bottom: 0;
            pointer-events: none;
        }
    }
</style>
