<script lang="ts">
  import { page } from "$app/stores";
  import {
    clue_color_action,
    clue_number_action,
    discard_action,
    join_action,
    makeStartAction,
    play_action,
    validColors,
    type FireworksState,
    getHandForPlayer,
    type Player,
    type CardId,
  } from "$lib/components/fireworks";
  import { store } from "$lib/store";
  import { onDestroy, onMount } from "svelte";
  import {
    collection,
    addDoc,
    serverTimestamp,
    orderBy,
    onSnapshot,
    query,
  } from "firebase/firestore";
  import { crossfade } from "svelte/transition";
  import { flip } from "svelte/animate";
  import { firebase } from "$lib/firebase";
  import { goto } from "$app/navigation";
  import type { AnyAction } from "@reduxjs/toolkit";
  import Card from "$lib/components/Card.svelte";
  import { quintOut } from "svelte/easing";

  let date = { d: new Date(), e: 3 };
  let tableId = $page.url.searchParams.get("table");
  let userId: string | null = null;

  let gamelog: AnyAction[] = [];
  let gamestates: FireworksState[] = [];

  const [send, receive] = crossfade({
    duration: (d) => 600,

    fallback(node, params) {
      const style = getComputedStyle(node);
      const transform = style.transform === "none" ? "" : style.transform;

      return {
        duration: 600,
        easing: quintOut,
        css: (t) => `
					transform: ${transform} scale(${t});
					opacity: ${t}
				`,
      };
    },
  });

  $: displayState = $store.fireworks;
  function displayName(index: number) {
    return displayState?.players[index].name;
  }
  function describeAction(index: number) {
    const action: AnyAction = gamelog[index];
    const state: FireworksState = gamestates[index + 1] || gamestates[0];
    const payload = action.payload;
    if (action.type === "join_action") {
      return `${payload.name} joined the game.`;
    }
    if (action.type === "start_action") {
      return `The game has started.`;
    }
    if (action.type === "discard_action") {
      return `${displayName(payload.player)} discarded ${
        getHandForPlayer(state, payload.player)[payload.index].name
      }`;
    }
    if (action.type === "play_action") {
      return `${displayName(payload.player)} played ${
        getHandForPlayer(state, payload.player)[payload.index].name
      }`;
    }
    if (action.type === "clue_color_action") {
      return `${displayName(payload.cluegiver)} told ${displayName(
        payload.player
      )} about ${payload.color} cards.`;
    }
    if (action.type === "clue_number_action") {
      return `${displayName(payload.cluegiver)} told ${displayName(
        payload.player
      )} about #${payload.value} cards.`;
    }
    return action.type;
  }

  let unsub: (() => void) | undefined = undefined;
  let interval: number = 0;
  onDestroy(async () => {
    if (unsub) {
      unsub();
    }
    if (interval) {
      clearInterval(interval);
    }
  });
  onMount(async () => {
    userId = localStorage.getItem("userId");
    if (!userId) {
      userId = `anon-${Math.round(Math.random() * 100000000)}`;
      localStorage.setItem("userId", userId);
    }
    if (!tableId) {
      const fireworks = collection(firebase.firestore, "games");
      const game = await addDoc(fireworks, {
        game: "fireworks",
        timestamp: serverTimestamp(),
      });
      goto(`?table=${game.id}`);
      tableId = game.id;
    }
    if (tableId) {
      const fireworks = collection(
        firebase.firestore,
        "games",
        tableId,
        "actions"
      );
      unsub = onSnapshot(
        query(fireworks, orderBy("timestamp")),
        (querySnapshot) => {
          querySnapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
              let action = { ...change.doc.data() } as AnyAction;
              delete action.timestamp;
              gamelog = [action, ...gamelog];
              store.dispatch(action as AnyAction);
              gamestates = [store.getState().fireworks, ...gamestates];
            }
          });
        }
      );
    }
  });
  function dispatch(action: AnyAction) {
    if (tableId) {
      const fireworks = collection(
        firebase.firestore,
        "games",
        tableId,
        "actions"
      );
      addDoc(fireworks, {
        ...action,
        timestamp: serverTimestamp(),
      });
    }
  }
  let joined = false;
  let lastPlayers: any = undefined;
  $: if (displayState?.players !== lastPlayers) {
    lastPlayers = displayState?.players;
    checkIfJoined();
  }
  $: playerIndex = displayState?.players.findIndex(
    (player) => player.userid == userId
  );
  let name = `Player ${displayState?.players.length + 1}`;
  function checkIfJoined() {
    joined = !!displayState?.players.find((player) => player.userid == userId);
    if (!joined && name.startsWith("Player")) {
      name = `Player ${displayState?.players.length + 1}`;
    }
  }
  function join() {
    if (userId) {
      dispatch(join_action({ userid: userId, name }));
    }
  }
  function start() {
    dispatch(makeStartAction(displayState?.players, displayState?.variant));
  }
  function discard(player: number, index: number) {
    if (player !== playerIndex) return () => {};
    return () => dispatch(discard_action({ player, index }));
  }
  function play(player: number, index: number) {
    if (player !== playerIndex) return () => {};
    return () => dispatch(play_action({ player, index }));
  }
  function clueColor(cluegiver: number, player: number, color: string) {
    return () => dispatch(clue_color_action({ cluegiver, player, color }));
  }
  function clueNumber(cluegiver: number, player: number, value: number) {
    return () => dispatch(clue_number_action({ cluegiver, player, value }));
  }

  function showState(stateIndex: number) {
    return () => {
      displayState = gamestates[stateIndex];
      console.log(`state ${stateIndex}`);
    };
  }
  function myTurn(displayState: FireworksState) {
    return (
      displayState?.turn === playerIndex && displayState === $store.fireworks
    );
  }
  function shouldBeFaceUp(player: Player) {
    return player.userid !== userId || $store.fireworks.state !== "playing";
  }
  function piles(state: FireworksState): CardId[] {
    let topCards: CardId[] = [];
    for (const color in state.piles) {
      const pile = state.piles[color];
      if (pile.length > 0) {
        topCards.push(pile[pile.length - 1]);
      }
    }
    console.log(topCards);
    return topCards;
  }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
{#if tableId}
  {#if !joined}
    <input type="text" bind:value={name} />
    <button on:click={join}>Join</button>
  {/if}
  <span class="gamelog">
    <span class="column">
      {#each gamelog as action, i (action)}
        <span class="row underlined" on:click={showState(i)}
          >{describeAction(i)}</span
        >
      {/each}
    </span>
  </span>
  {#if joined && displayState?.players.length > 1 && displayState?.players.length < 6 && displayState?.state === "notstarted"}
    <button on:click={start}>Start Game</button>
  {/if}
  {#each displayState?.players as p, pi}
    <p>
      {#if displayState?.turn === pi}
        *
      {/if}
      {p.name}
      {#if displayState?.state !== "notstarted"}
        {@const cardInfo = getHandForPlayer(displayState, pi)}
        {#each cardInfo as card, ci (card.id)}
          {@const possible =
            displayState?.hgroup.inference[pi].cards[card.id].possible}
          <span
            class="cardblock"
            in:receive={{ key: card.id }}
            out:send={{ key: card.id }}
            animate:flip
          >
            <span on:click={play(pi, ci)}>
              <Card
                card={card.name}
                cluedColor={card.cluedColor}
                cluedNumber={card.cluedNumber}
                faceup={shouldBeFaceUp(p)}
                chop={displayState?.hgroup.chop[pi] === ci}
                focus={displayState?.hgroup.focus[pi] === card.id}
                debug={possible.length <= 6
                  ? possible.join(" ")
                  : `(${possible.length})`}
              />
            </span><br />
            {#if pi === playerIndex && myTurn(displayState) && displayState?.clues < 8}
              <button on:click={discard(pi, ci)}>x</button>
            {/if}</span
          >
        {/each}

        {#if pi !== playerIndex && myTurn(displayState) && displayState?.clues > 0}
          {#each validColors(displayState?.variant) as color}
            <button on:click={clueColor(playerIndex, pi, color)}
              >Clue {color}</button
            >
          {/each}
          {#each [1, 2, 3, 4, 5] as value}
            <button on:click={clueNumber(playerIndex, pi, value)}
              >Clue {value}</button
            >
          {/each}
        {/if}
      {/if}
    </p>
  {/each}
  <div>
    Deck: {displayState?.deck.length}
    {#each displayState?.deck.slice(0, 1) as cardId (cardId)}
      <span
        class="cardblock"
        in:receive={{ key: cardId }}
        out:send={{ key: cardId }}
        animate:flip
      >
        <Card card={cardId} faceup={false} />
      </span>
    {/each}
  </div>
  <div>
    <p>State: {displayState?.state}</p>
    <p>
      Score: {Object.values(displayState?.piles).reduce(
        (prev, cur) => cur.length + prev,
        0
      )}
    </p>
    <p>Clues: {displayState?.clues}</p>
    <p>Faults: {displayState?.faults}</p>
  </div>
  <div>
    Play Area:
    {#each piles(displayState) as cardId (cardId)}
      <span
        class="cardblock"
        in:receive={{ key: cardId }}
        out:send={{ key: cardId }}
        animate:flip
      >
        <Card card={cardId} faceup={true} />
      </span>
    {/each}
  </div>
  <div>
    Discard Pile: {#each Object.entries(displayState?.discard.slice()).sort( (a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) ) as d (d[1])}
      {@const cardId = d[1]}
      <span
        class="cardblock"
        in:receive={{ key: cardId }}
        out:send={{ key: cardId }}
        animate:flip
      >
        <Card card={cardId} faceup={true} />
        {#if parseInt(d[0]) === displayState?.discard.length - 1}
          <br />*
        {/if}
      </span>
    {/each}
  </div>
{:else}
  Creating table ...
{/if}

<style>
  .cardblock {
    display: inline-block;
  }

  .underlined {
    border-bottom: 1px dashed #aeaeae;
  }
  .column {
    display: flex;
    flex-direction: column;
  }
  .row {
    display: flex;
    flex-direction: column;
  }

  .gamelog {
    display: block;
    width: 25%;
    border: 1px solid #aeaeae;
    margin: 1em;
    float: right;
  }
  .gamelog > span > span {
    padding: 1em;
  }
  .gamelog > span > span:hover {
    background-color: #a0e8a0;
  }
</style>
