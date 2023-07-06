<script lang="ts">
    export let card = "";
    export let faceup = false;
    export let chop = false;
    export let focus = false;
    export let cluedColor: string | undefined = undefined;
    export let cluedNumber: number | undefined = undefined;
</script>


<div class:faceup class:chop class:focus class="card color-{card[0]} value-{card[1]}">
    <div class=transform>
        <div class=front></div>
        <div class=value>{card[1]}</div>
        <div class=back></div>
    </div>
    {#if cluedColor || cluedNumber}
        <div class="clue clue-{cluedColor || "unknown"}">{cluedNumber || ""}</div>
    {/if}
</div>

<style>
    .card {
        display: inline-block;
        width: 71px;
        height: 100px;
        position: relative;
        margin: 2px;
        border-bottom: 5px solid transparent;
    }
    .chop {
        outline: 2px solid red;
    }
    .focus {
        border-bottom: 5px solid gray;
    }

    .transform {
        transform: rotateY(180deg);
        width: 100%;
        height: 100%;
        position: relative;
        transform-style: preserve-3d;
        border: 1px solid grey;
        border-radius: 3px;
        box-sizing: border-box;
    }

    .faceup .transform {
        transform: none;
    }

    .front, .back {
        position: absolute;
        background-size: cover;
        backface-visibility: hidden;
        width: 100%;
        height: 100%;
        box-sizing: border-box;
    }

    .value {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        color: white;
        filter: drop-shadow(1px 1px 3px rgba(0, 0, 0, 0.8));
        font-size: 32px;
    }

    .value-1 .front {
        background-image: url(/images/1.jpg);
    }
    .value-2 .front {
        background-image: url(/images/2.jpg);
    }
    .value-3 .front {
        background-image: url(/images/3.jpg);
    }
    .value-4 .front {
        background-image: url(/images/4.jpg);
    }
    .value-5 .front {
        background-image: url(/images/5.jpg);
    }
    .color-W .front {
        filter: saturate(0%) brightness(150%);
    }
    .color-G .front {
        filter: hue-rotate(90deg);
    }
    .color-B .front {
        filter: hue-rotate(195deg);
    }
    .color-Y .front {
        filter: hue-rotate(45deg);
    }

    .back {
        background-image: url(/images/bg.jpg);
        transform: rotateY(180deg);
    }

    .card div {
        position: absolute;
    }

    .clue {
        width: 20%;
        height: 20%;
        border-radius: 5px;
        text-align: center;
        border: 1px solid black;
        top: 2px;
        left: 2px;
        color: white;
    }
    .clue-R {
        background: red;
        color: white;
    }
    .clue-G {
        background: green;
        color: white;
    }
    .clue-B {
        background: blue;
        color: white;
    }
    .clue-Y {
        background: yellow;
        color: black;
    }
    .clue-W {
        background: white;
        color: black;
    }
</style>