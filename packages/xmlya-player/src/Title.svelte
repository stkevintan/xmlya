<script>
    export let title = '';
    export let album = '';
</script>

{#if title}
    <div class="title-container">
        <h1 class="ellipsis">{title}</h1>
        {#if album}
            <author class="ellipsis">{album}</author>
        {/if}
    </div>
{/if}

<style lang="less">
    .ellipsis {
        text-overflow: ellipsis;
        overflow: hidden;
        white-space: nowrap;
    }
    .title-container {
        line-height: 20px;
        text-align: center;
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
