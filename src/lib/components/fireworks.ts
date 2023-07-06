import type { AnyAction } from "@reduxjs/toolkit";
import * as toolkitRaw from "@reduxjs/toolkit";
import type { WritableDraft } from "immer/dist/internal";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { createAction, createReducer } = ((toolkitRaw as any).default ??
  toolkitRaw) as typeof toolkitRaw;

export interface Player {
  userid: string;
  name: string;
}

export type GameState = "notstarted" | "playing" | "win" | "fault" | "time";
export type Variant = "standard";
export type Deck = CardId[];

export interface CardInfo {
  name: string;
  cluedColor: string | undefined;
  cluedNumber: number | undefined;
}

export function getHandForPlayer(
  state: FireworksState,
  player: number
): CardInfo[] {
  let cards = [];
  for (let i = 0; i < state.hand[player].cards.length; ++i) {
    const cardInfo = state.cardToCardInfo[state.hand[player].cards[i]];
    cards.push(cardInfo);
  }
  return cards;
}

export type CardId = string;
export type Slot = number | undefined;
export interface Hand {
  cards: CardId[];
}

export interface HandInference {}
export interface HGroupState {
  priorHands: Hand[];
  chop: Slot[];
  focus: (CardId | undefined)[];
}
export interface FireworksState {
  players: Player[];
  variant: Variant;
  deck: Deck;
  hand: Hand[];
  discard: Deck;
  faults: number;
  clues: number;
  piles: { [key: string]: Deck };
  state: GameState;
  turn: number;
  finalTurns: number;
  hgroup: HGroupState;
  cardToCardInfo: { [k: string]: CardInfo };
}

export const join_action = createAction<Player>("join_action");
export const start_action = createAction<{ deck: Deck; players: Player[] }>(
  "start_action"
);
export const discard_action = createAction<{ player: number; index: number }>(
  "discard_action"
);
export const play_action = createAction<{ player: number; index: number }>(
  "play_action"
);
export const clue_number_action = createAction<{
  cluegiver: number;
  player: number;
  value: number;
}>("clue_number_action");
export const clue_color_action = createAction<{
  cluegiver: number;
  player: number;
  color: string;
}>("clue_color_action");

export const initialState = {
  players: [],
  variant: "standard",
  deck: [],
  hand: [],
  discard: [],
  faults: 0,
  clues: 8,
  piles: {},
  state: "notstarted",
  turn: 0,
  finalTurns: 0,
  hgroup: {
    priorHands: [],
    chop: [],
    focus: [],
  },
  cardToCardInfo: {},
} as FireworksState;

export function shuffle<T>(elements: T[]) {
  const ret = elements.slice(0);
  for (let i = ret.length - 1; i > 0; --i) {
    const item = Math.round(Math.random() * i);
    [ret[i], ret[item]] = [ret[item], ret[i]];
  }
  return ret;
}

export function validColors(variant: Variant) {
  return ["W", "R", "B", "Y", "G"];
}

export function makeFullDeck(variant: Variant) {
  let deck = [];
  for (let color of validColors(variant)) {
    for (let number = 1; number <= 5; ++number) {
      let count = [3, 2, 2, 2, 1][number - 1];
      for (; count > 0; --count) {
        deck.push(`${color}${number}-${count}`);
      }
    }
  }
  return deck;
}
export function makeStartAction(players: Player[], variant: Variant) {
  let deck = makeFullDeck(variant);
  deck = shuffle(deck);
  let order = shuffle(players);
  return start_action({ deck, players: order });
}

function draw(state: WritableDraft<FireworksState>, player: number) {
  if (state.deck.length > 0) {
    const drawn = state.deck.splice(0, 1)[0];
    state.hand[player].cards.splice(0, 0, drawn);
  }
}

function endTurn(state: WritableDraft<FireworksState>, action: AnyAction) {
  hgroup(state, action);
  state.turn = (state.turn + 1) % state.players.length;
  if (state.state === "playing") {
    let incomplete = 0;
    for (let color in state.piles) {
      if (state.piles[color].length < 5) {
        ++incomplete;
        break;
      }
    }
    if (incomplete === 0) {
      state.state = "win";
    } else {
      if (state.faults === 3) {
        state.state = "fault";
      } else if (state.deck.length === 0) {
        if (state.finalTurns === state.players.length) {
          state.state = "time";
        }
        state.finalTurns++;
      }
    }
  }
}

function cluedCards(state: WritableDraft<FireworksState>, action: AnyAction) {
  const player = action.payload.player;
  const cards = state.hand[player].cards;
  const ret: number[] = [];
  cards.forEach((card, i) => {
    // TODO: Multicolor matching all color variant.
    if (
      (action.type === "clue_color_action" &&
        action.payload.color === card[0]) ||
      (action.type === "clue_number_action" &&
        action.payload.value === parseInt(card[1]))
    ) {
      ret.push(i);
    }
  });
  return ret;
}

export const hgroup = createReducer(initialState, (r) => {
  function chop(state: WritableDraft<FireworksState>, action: AnyAction) {
    const player = action.payload.player;
    const hand = state.hand[player];
    state.hgroup.chop[player] = undefined;
    for (let i = hand.cards.length - 1; i >= 0; --i) {
      if (
        state.cardToCardInfo[hand.cards[i]].cluedColor === undefined &&
        state.cardToCardInfo[hand.cards[i]].cluedNumber === undefined
      ) {
        state.hgroup.chop[player] = i;
        return;
      }
    }
  }
  function focus(state: WritableDraft<FireworksState>, action: AnyAction) {
    const player = action.payload.player;
    if (action.payload.index === undefined) {
      let newCluedCards = [];
      for (let i = 0; i < state.hand[player].cards.length; i++) {
        const cardInfo = state.cardToCardInfo[state.hand[player].cards[i]];
        const priorCardInfo =
          state.cardToCardInfo[state.hgroup.priorHands[player].cards[i]];
        if (
          cardInfo.cluedColor !== priorCardInfo.cluedColor ||
          cardInfo.cluedNumber !== priorCardInfo.cluedNumber
        ) {
          newCluedCards.push(i);
        }
      }
      if (newCluedCards.length > 0) {
        // If chop slot was clued.
        const chop = state.hgroup.chop[player];
        if (
          chop !== undefined &&
          newCluedCards[newCluedCards.length - 1] === chop
        ) {
          state.hgroup.focus[player] = state.hand[player].cards[chop];
        } else {
          state.hgroup.focus[player] =
            state.hand[player].cards[newCluedCards[0]];
        }
      } else {
        const clued = cluedCards(state, action);
        if (cluedCards.length > 0) {
          state.hgroup.focus[player] = state.hand[player].cards[clued[0]];
        } else {
          state.hgroup.focus[player] = undefined;
        }
      }
    }
    state.hgroup.priorHands = state.hand;
  }
  r.addCase(start_action, (state, action) => {
    state.hgroup.chop = state.hand.map((hand) => hand.cards.length - 1);
    state.hgroup.focus = state.hand.map((x) => undefined);
    state.hgroup.priorHands = state.hand;
  });
  r.addCase(clue_color_action, (state, action) => {
    console.log("hgroup clue color");
    focus(state, action);
    chop(state, action);
  });
  r.addCase(play_action, (state, action) => {
    focus(state, action);
    chop(state, action);
  });
  r.addCase(discard_action, (state, action) => {
    focus(state, action);
    chop(state, action);
  });
  r.addCase(clue_number_action, (state, action) => {
    focus(state, action);
    chop(state, action);
  });
});
export const fireworks = createReducer(initialState, (r) => {
  r.addCase(join_action, (state, action) => {
    state.players.push(action.payload);
  });
  r.addCase(start_action, (state, action) => {
    state.state = "playing";
    state.deck = action.payload.deck;
	for (let card of state.deck) {
		state.cardToCardInfo[card] = {
			name: card.substring(0, 2),
			cluedColor: undefined,
			cluedNumber: undefined
		};
	}
    state.players = action.payload.players;
    const numCards = state.players.length > 3 ? 4 : 5;
    for (let i = 0; i < state.players.length; ++i) {
      const cards = state.deck.splice(0, numCards);
      state.hand.push({
        cards,
      });
    }
    for (let color of validColors(state.variant)) {
      state.piles[color] = [];
    }
    hgroup(state, action);
  });
  r.addCase(discard_action, (state, action) => {
    if (state.turn === action.payload.player && state.clues < 8) {
      state.clues++;
      let discarded = state.hand[action.payload.player].cards.splice(
        action.payload.index,
        1
      )[0];
      state.discard.push(discarded);
      draw(state, action.payload.player);
      endTurn(state, action);
    }
  });
  r.addCase(play_action, (state, action) => {
    if (state.turn === action.payload.player) {
      let played = state.hand[action.payload.player].cards.splice(
        action.payload.index,
        1
      )[0];
      const targetPile = state.piles[played[0]];
      const nextValue = targetPile.length + 1;
      if (parseInt(played[1]) !== nextValue) {
        state.faults++;
        state.discard.push(played);
      } else {
        if (parseInt(played[1]) === 5 && state.clues < 8) {
          state.clues++;
        }
        targetPile.push(played);
      }
      draw(state, action.payload.player);
      endTurn(state, action);
    }
  });
  r.addCase(clue_color_action, (state, action) => {
    console.log("base clue color");
    if (state.turn === action.payload.cluegiver && state.clues > 0) {
      state.clues--;
      let hand = state.hand[action.payload.player];
      for (let i of cluedCards(state, action)) {
		state.cardToCardInfo[hand.cards[i]].cluedColor = action.payload.color;
      }
      endTurn(state, action);
    }
  });
  r.addCase(clue_number_action, (state, action) => {
    if (state.turn === action.payload.cluegiver && state.clues > 0) {
      state.clues--;
      let hand = state.hand[action.payload.player];
      for (let i of cluedCards(state, action)) {
		state.cardToCardInfo[hand.cards[i]].cluedNumber = action.payload.value;
      }
      endTurn(state, action);
    }
  });
});
