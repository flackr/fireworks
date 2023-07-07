import type { AnyAction } from "@reduxjs/toolkit";
import * as toolkitRaw from "@reduxjs/toolkit";
import type { WritableDraft } from "immer/dist/types/types-external";
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
	id: CardId;
	name: string;
	cluedColor: string | undefined;
	cluedNumber: number | undefined;
}

export function getHandForPlayer(
	state: FireworksState,
	player: number,
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

export type InferredPlayState = "now" | "later" | undefined;
export interface CardInference {
	play: InferredPlayState;
	save: boolean | undefined;
	possible: string[];
}
export interface PlayerInference {
	// Each player may infer different things about the same cards.
	// For example, Bob may know that his 5 must be red because he can
	// see the other 5's in Alice's hand, but Alice doesn't know that
	// Bob knows this because she can't see her 5.
	cards: { [key: CardId]: CardInference };
}

// Inferred states based on hgroup convention:
// https://hanabi.github.io/docs/beginner
export interface HGroupState {
	priorCardToCardInfo: { [k: string]: CardInfo };
	chop: Slot[];
	focus: (CardId | undefined)[];
	inference: PlayerInference[];
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
	"start_action",
);
export const discard_action = createAction<{ player: number; index: number }>(
	"discard_action",
);
export const play_action = createAction<{ player: number; index: number }>(
	"play_action",
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
		priorCardToCardInfo: {},
		chop: [],
		focus: [],
		inference: [],
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

function allCardNames(state: FireworksState): string[] {
	return Object.values(state.cardToCardInfo).map((cardInfo) => cardInfo.name);
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
		let newCluedCards = [];
		for (let i = 0; i < state.hand[player].cards.length; i++) {
			const card = state.hand[player].cards[i];
			const cardInfo = state.cardToCardInfo[card];
			const priorCardInfo = state.hgroup.priorCardToCardInfo[card];
			if (
				priorCardInfo.cluedColor === undefined &&
				priorCardInfo.cluedNumber === undefined &&
				(cardInfo.cluedColor !== undefined ||
					cardInfo.cluedNumber !== undefined)
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
				state.hgroup.focus[player] = state.hand[player].cards[newCluedCards[0]];
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
	function infer(state: WritableDraft<FireworksState>, action: AnyAction) {
		let counts: { [k: string]: number } = {};
		for (
			let playerIndex = 0;
			playerIndex < state.players.length;
			playerIndex++
		) {
			let perPlayerCounts: { [k: string]: number } = {};
			for (let card of allCardNames(state)) {
				perPlayerCounts[card] = (perPlayerCounts[card] || 0) + 1;
			}
			for (let color in state.piles) {
				for (let cardId of state.piles[color]) {
					perPlayerCounts[state.cardToCardInfo[cardId].name]--;
				}
			}
			for (let cardId of state.discard) {
				perPlayerCounts[state.cardToCardInfo[cardId].name]--;
			}
			for (let i = 0; i < state.players.length; i++) {
				const hand = getHandForPlayer(state, i);
				for (let card of hand) {
					if (i === playerIndex) {
						const inferred = state.hgroup.inference[playerIndex].cards[card.id];
						if (inferred.possible.length == 1) {
							perPlayerCounts[inferred.possible[0]]--;
						}
					} else {
						perPlayerCounts[card.name]--;
					}
				}
			}
			if (playerIndex === action.payload.player) {
				counts = perPlayerCounts;
			}
			for (let card of state.hand[playerIndex].cards) {
				// update possible list for each card
				const cardInfo = state.cardToCardInfo[card];
				let filterMe = state.hgroup.inference[playerIndex].cards[card].possible;
				if (filterMe.length === 1) continue;
				filterMe = filterMe.filter((x) => perPlayerCounts[x] > 0);
				if (cardInfo.cluedColor !== undefined) {
					filterMe = filterMe.filter((x) => x[0] === cardInfo.cluedColor);
				}
				if (cardInfo.cluedNumber !== undefined) {
					filterMe = filterMe.filter(
						(x) => parseInt(x[1]) === cardInfo.cluedNumber,
					);
				}
				// No bad touch filter
				if (
					cardInfo.cluedNumber !== undefined ||
					cardInfo.cluedColor !== undefined
				) {
					filterMe = filterMe.filter((name) => {
						// Work out what playable cards have been cued up and exclude them.
						const next = state.piles[name[0]].length + 1;
						return parseInt(name[1]) >= next;
					});
				}
				state.hgroup.inference[playerIndex].cards[card].possible = filterMe;
			}
		}

		if (action.payload.index !== undefined) {
			// TODO: Infer more things from play or discard actions (like bluffs)
			return;
		}
		const player = action.payload.player;
		for (let card of state.hand[player].cards) {
			const cardInfo = state.cardToCardInfo[card];
			if (
				action.payload.color !== undefined &&
				cardInfo.cluedColor === undefined
			) {
				state.hgroup.inference[player].cards[card].possible =
					state.hgroup.inference[player].cards[card].possible.filter(
						(name) => name[0] !== action.payload.color,
					);
			}
			if (
				action.payload.value !== undefined &&
				cardInfo.cluedNumber === undefined
			) {
				state.hgroup.inference[player].cards[card].possible =
					state.hgroup.inference[player].cards[card].possible.filter(
						(name) => parseInt(name[1]) !== action.payload.value,
					);
			}
			if (
				cardInfo.cluedColor !== undefined &&
				cardInfo.cluedNumber !== undefined
			) {
				const name = `${cardInfo.cluedColor}${cardInfo.cluedNumber}`;
				const cardInference = state.hgroup.inference[player].cards[card];
				if (cardInference.possible.length !== 1) {
					console.error(
						"unexpected number of cards in possible",
						cardInference.possible,
					);
				} else if (cardInference.possible[0] !== name) {
					console.error(
						`unexpected card ${cardInference.possible[0]} instead of ${name}`,
					);
				}
				cardInference.possible = [name];
			}
		}

		// A clue is assumed to be about the focused card.
		const focused = state.hgroup.focus[player];
		if (focused === undefined) {
			return;
		}
		let cluePosition = state.hand[player].cards.indexOf(focused);
		const cardInfo = state.cardToCardInfo[focused];
		const priorCardInfo = state.hgroup.priorCardToCardInfo[focused];
		if (
			cluePosition === state.hgroup.chop[player] &&
			priorCardInfo.cluedColor === undefined &&
			priorCardInfo.cluedNumber === undefined
		) {
			state.hgroup.inference[player].cards[focused].save = true;
		} else {
			state.hgroup.inference[player].cards[focused].save = false;
		}
		let inPlayCounts: { [k: string]: number } = {};
		for (let card of allCardNames(state)) {
			inPlayCounts[card] = (inPlayCounts[card] || 0) + 1;
		}
		for (let color in state.piles) {
			for (let cardId of state.piles[color]) {
				inPlayCounts[state.cardToCardInfo[cardId].name]--;
			}
		}
		for (let cardId of state.discard) {
			inPlayCounts[state.cardToCardInfo[cardId].name]--;
		}

		// TODO: Check for deferred plays.
		let possible: string[] = [];
		state.hgroup.inference[player].cards[focused].play = "now";
		const save = state.hgroup.inference[player].cards[focused].save;
		if (
			cardInfo.cluedColor !== undefined &&
			cardInfo.cluedNumber !== undefined
		) {
			possible.push(`${cardInfo.cluedColor}${cardInfo.cluedNumber}`);
		} else if (cardInfo.cluedColor !== undefined) {
			if (save) {
				for (let value = state.piles[cardInfo.cluedColor].length; value <= 5; ++value) {
					const name = `${cardInfo.cluedColor}${value}`;
					if (inPlayCounts[name] === 1) {
						possible.push(name);
					}
				}
			}
			let inferenceCount = 0;
			let cluedCardsOfColor = [];
			for (let i = 0; i < state.players.length; i++) {
				const hand = getHandForPlayer(state, i);
				for (let card of hand) {
					if (card.cluedColor === undefined && card.cluedNumber === undefined)
						continue;
					if (i === player) {
						const inferred = state.hgroup.inference[player].cards[card.id];
						if (inferred.possible.length == 1 && card.id !== focused) {
							cluedCardsOfColor.push(inferred.possible[0]);
						}
					} else if (card.name[0] === cardInfo.cluedColor) {
						cluedCardsOfColor.push(card.name);
					}
				}
			}
			cluedCardsOfColor = cluedCardsOfColor.sort();
			for (let cluedCard of cluedCardsOfColor) {
				const nextPlay =
					state.piles[cardInfo.cluedColor].length + 1 + inferenceCount;
				if (
					cluedCard[0] === cardInfo.cluedColor &&
					parseInt(cluedCard[1]) === nextPlay
				) {
					inferenceCount++;
				}
			}
			possible.push(
				`${cardInfo.cluedColor}${
					state.piles[cardInfo.cluedColor].length + 1 + inferenceCount
				}`,
			);
			if (inferenceCount > 0) {
				state.hgroup.inference[player].cards[focused].play = "later";
			}
		} else if (cardInfo.cluedNumber !== undefined) {
			if (save) {
				for (let color in state.piles) {
					const name = `${color}${cardInfo.cluedNumber}`;
					if ((cardInfo.cluedNumber === 2 || inPlayCounts[name] === 1) && state.piles[color].length < cardInfo.cluedNumber) {
						possible.push(name);
					}
				}
			}
			for (let color in state.piles) {
				if (state.piles[color].length + 1 === cardInfo.cluedNumber) {
					possible.push(`${color}${cardInfo.cluedNumber}`);
				}
			}
		}
		possible = possible.filter((card) => counts[card] > 0);
		if (possible.length) {
			const filterMe = state.hgroup.inference[player].cards[focused].possible;
			state.hgroup.inference[player].cards[focused].possible = filterMe.filter(
				(x) => possible.indexOf(x) !== -1,
			);
		}
	}
	r.addCase(start_action, (state, action) => {
		state.hgroup.chop = state.hand.map((hand) => hand.cards.length - 1);
		state.hgroup.focus = state.hand.map((x) => undefined);
		state.hgroup.priorCardToCardInfo = state.cardToCardInfo;
	});
	r.addCase(clue_color_action, (state, action) => {
		focus(state, action);
		infer(state, action);
		chop(state, action);
		state.hgroup.priorCardToCardInfo = state.cardToCardInfo;
	});
	r.addCase(play_action, (state, action) => {
		infer(state, action);
		chop(state, action);
		state.hgroup.priorCardToCardInfo = state.cardToCardInfo;
	});
	r.addCase(discard_action, (state, action) => {
		infer(state, action);
		chop(state, action);
		state.hgroup.priorCardToCardInfo = state.cardToCardInfo;
	});
	r.addCase(clue_number_action, (state, action) => {
		focus(state, action);
		infer(state, action);
		chop(state, action);
		state.hgroup.priorCardToCardInfo = state.cardToCardInfo;
	});
});
export const fireworks = createReducer(initialState, (r) => {
	r.addCase(join_action, (state, action) => {
		state.players.push(action.payload);
	});
	r.addCase(start_action, (state, action) => {
		state.state = "playing";
		state.deck = action.payload.deck;
		let inferences: PlayerInference = { cards: {} };
		let allPossible = new Set();
		for (let card of state.deck) {
			const name = card.substring(0, 2);
			allPossible.add(name);
			state.cardToCardInfo[card] = {
				id: card,
				name,
				cluedColor: undefined,
				cluedNumber: undefined,
			};
		}

		for (let card of state.deck) {
			inferences.cards[card] = {
				play: undefined,
				save: undefined,
				possible: [...allPossible] as string[],
			};
		}
		state.players = action.payload.players;
		const numCards = state.players.length > 3 ? 4 : 5;
		for (let i = 0; i < state.players.length; ++i) {
			const cards = state.deck.splice(0, numCards);
			state.hand.push({
				cards,
			});
			state.hgroup.inference.push(inferences);
		}
		for (let color of validColors(state.variant)) {
			state.piles[color] = [];
		}
		hgroup(state, action);
	});
	r.addCase(discard_action, (state, action) => {
		if (
			state.state === "playing" &&
			state.turn === action.payload.player &&
			state.clues < 8
		) {
			state.clues++;
			let discarded = state.hand[action.payload.player].cards.splice(
				action.payload.index,
				1,
			)[0];
			state.discard.push(discarded);
			draw(state, action.payload.player);
			endTurn(state, action);
		}
	});
	r.addCase(play_action, (state, action) => {
		if (state.state === "playing" && state.turn === action.payload.player) {
			let played = state.hand[action.payload.player].cards.splice(
				action.payload.index,
				1,
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
		if (
			state.state === "playing" &&
			state.turn === action.payload.cluegiver &&
			state.clues > 0
		) {
			state.clues--;
			let hand = state.hand[action.payload.player];
			for (let i of cluedCards(state, action)) {
				state.cardToCardInfo[hand.cards[i]].cluedColor = action.payload.color;
			}
			endTurn(state, action);
		}
	});
	r.addCase(clue_number_action, (state, action) => {
		if (
			state.state === "playing" &&
			state.turn === action.payload.cluegiver &&
			state.clues > 0
		) {
			state.clues--;
			let hand = state.hand[action.payload.player];
			for (let i of cluedCards(state, action)) {
				state.cardToCardInfo[hand.cards[i]].cluedNumber = action.payload.value;
			}
			endTurn(state, action);
		}
	});
});
