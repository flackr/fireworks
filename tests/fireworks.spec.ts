import { describe, expect, it } from "vitest";
import {
	clue_color_action,
	clue_number_action,
	discard_action,
	fireworks,
	getHandForPlayer,
	initialState,
	join_action,
	makeFullDeck,
	play_action,
	start_action,
	type FireworksState,
	type Player,
} from "$lib/components/fireworks";

// Sets up a known state with the top card on each pile as passed in, and each hand with
// the given cards in hand, the given deck remaining and starting on the given turn.
function setupState(setup: {
	piles: string[];
	hands: string[][];
	deck: string[];
	turn: number;
}): FireworksState {
	let { piles, hands, deck, turn } = setup;
	hands = JSON.parse(JSON.stringify(hands));
	const handLength = hands[0].length;
	let state = { ...initialState };
	let players: Player[] = [];
	for (let i = 0; i < hands.length; i++) {
		const player = {
			userid: `user${i}`,
			name: `user${i}`,
		};
		players.push(player);
		state = fireworks(state, join_action(player));
	}
	let playCards: string[] = [];
	let index = 0;
	for (let i = 0; i < piles.length; ++i) {
		for (let value = 1; value <= parseInt(piles[i][1]); ++value) {
			playCards.push(`${piles[i][0]}${value}-generated-${++index}`);
		}
	}
	const plays = playCards.length;
	let used = new Set();
	function makeUnique(name: string) {
		if (!used.has(name)) {
			used.add(name);
			return name;
		}
		return `${name}-generated-${++index}`;
	}
	let initialDeck: string[] = [];
	let initialHands: string[][] = hands.map((x) => []);
	let initialTurn =
		(((turn - plays) % hands.length) + hands.length) % hands.length;
	let t = initialTurn;
	expect(t).to.be.lessThan(hands.length);
	// Set up the play cards to be available to be played first.
	while (playCards.length > 0) {
		let next = playCards.splice(0, 1)[0];
		if (initialHands[t].length < handLength) {
			initialHands[t].splice(0, 0, next);
		} else {
			initialDeck.push(next);
		}
		t = (t + 1) % hands.length;
	}
	// Then ensure each player has the expected hands.
	while (true) {
		if (hands[t].length == 0) {
			break;
		}
		let next = makeUnique(hands[t].splice(-1, 1)[0]);
		if (initialHands[t].length < handLength) {
			initialHands[t].splice(0, 0, next);
		} else {
			initialDeck.push(next);
		}
		t = (t + 1) % hands.length;
	}
	// Maybe check that all hands are empty now?
	for (let card of deck) {
		initialDeck.push(makeUnique(card));
	}

	// Add player hands to start of deck
	for (let i = initialHands.length - 1; i >= 0; --i) {
		initialDeck = initialHands[i].concat(initialDeck);
	}
	state = fireworks(
		state,
		start_action({
			deck: initialDeck,
			players,
		}),
	);
	// Manipulate initial turn to achieve desired end turn.
	state = { ...state, turn: initialTurn };
	t = initialTurn;
	for (let i = 0; i < plays; ++i) {
		state = fireworks(
			state,
			play_action({
				player: t,
				index: handLength - 1,
			}),
		);
		t = (t + 1) % hands.length;
	}
	return state;
}

describe("fireworks", () => {
	const p0 = {
		userid: "anon1234",
		name: "Player 1",
	};
	const p1 = {
		userid: "anon5678",
		name: "Player 2",
	};
	const players = [p1, p0];
	it("Can set up a new game", () => {
		let state = initialState;
		expect(state.players.length).to.equal(0);
		state = fireworks(state, join_action(p0));
		expect(state.players.length).to.equal(1);
		expect(state.players[0]).to.equal(p0);
		state = fireworks(state, join_action(p1));
		expect(state.players.length).to.equal(2);
		expect(state.players[0]).to.equal(p0);
		expect(state.players[1]).to.equal(p1);
		const deck = makeFullDeck("standard");
		state = fireworks(
			state,
			start_action({
				players,
				deck,
			}),
		);
		expect(state.players.length).to.equal(2);
		expect(state.players[0]).to.equal(p1);
		expect(state.players[1]).to.equal(p0);
		let hands = [getHandForPlayer(state, 0), getHandForPlayer(state, 1)];
		expect(hands[0].length).to.equal(5);
		expect(hands[1].length).to.equal(5);

		// Loose expectations based on default deck construction.
		expect(hands[0][0].name).to.equal("W1");
		expect(hands[1][0].name).to.equal("W3");
	});
	it("Can mark and track clued states", () => {
		let state = initialState;
		state = fireworks(state, join_action(p0));
		state = fireworks(state, join_action(p1));
		const p0cards = ["R3", "W1", "B2", "G1", "W3"];
		const p1cards = ["W2", "B4", "R1", "B2", "W5"];
		const deck = [...p0cards, ...p1cards];
		state = fireworks(
			state,
			start_action({
				players: [p0, p1],
				deck,
			}),
		);
		const clueNumber = clue_number_action({
			cluegiver: 1,
			player: 0,
			value: 1,
		});
		// check that out of order turns have no effect
		state = fireworks(state, clueNumber);
		let p0hand = getHandForPlayer(state, 0);
		expect(p0hand[1].cluedNumber).to.equal(undefined);
		expect(p0hand[3].cluedNumber).to.equal(undefined);
		let p1hand = getHandForPlayer(state, 1);
		expect(p1hand[2].cluedColor).to.equal(undefined);
		state = fireworks(
			state,
			clue_color_action({
				cluegiver: 0,
				player: 1,
				color: "R",
			}),
		);
		p1hand = getHandForPlayer(state, 1);
		expect(p1hand[0].cluedColor).to.equal(undefined);
		expect(p1hand[1].cluedColor).to.equal(undefined);
		expect(p1hand[2].cluedColor).to.equal("R");
		expect(p1hand[3].cluedColor).to.equal(undefined);
		expect(p1hand[4].cluedColor).to.equal(undefined);
		state = fireworks(state, clueNumber);
		p0hand = getHandForPlayer(state, 0);
		expect(p0hand[0].cluedNumber).to.equal(undefined);
		expect(p0hand[1].cluedNumber).to.equal(1);
		expect(p0hand[2].cluedNumber).to.equal(undefined);
		expect(p0hand[3].cluedNumber).to.equal(1);
		expect(p0hand[4].cluedNumber).to.equal(undefined);
	});
	it("Can infer basic color play clues", () => {
		let state = initialState;
		state = fireworks(state, join_action(p0));
		state = fireworks(state, join_action(p1));
		const p0cards = ["B1", "W1", "B2", "G1", "W3"];
		const p1cards = ["W2", "B4", "R1", "B3", "W5"];
		const deck = [...p0cards, ...p1cards, "G2"];
		state = fireworks(
			state,
			start_action({
				players: [p0, p1],
				deck,
			}),
		);
		let p0hand = getHandForPlayer(state, 0);
		state = fireworks(state, play_action({ player: 0, index: 0 }));
		expect(p0hand[2].cluedColor).to.equal(undefined);
		state = fireworks(
			state,
			clue_color_action({ cluegiver: 1, player: 0, color: "B" }),
		);
		p0hand = getHandForPlayer(state, 0);
		expect(p0hand[2].cluedColor).to.equal("B");
		const inference = state.hgroup.inference[0].cards["B2"];
		expect(inference.play).to.equal("now");
		expect(inference.save).to.equal(false);
		expect(inference.possible.length).to.equal(1);
		expect(inference.possible[0]).to.equal("B2");
	});
	it("Can infer basic number play clues", () => {
		let state = initialState;
		state = fireworks(state, join_action(p0));
		state = fireworks(state, join_action(p1));
		const p0cards = ["B1", "W1", "B2", "G5", "W3"];
		const p1cards = ["G1", "B4", "R1", "B3", "W5"];
		const deck = [...p0cards, ...p1cards, "Y3", "G2", "B2-a", "G2"];
		state = fireworks(
			state,
			start_action({
				players: [p0, p1],
				deck,
			}),
		);
		let p1hand = getHandForPlayer(state, 0);
		state = fireworks(state, play_action({ player: 0, index: 0 }));
		state = fireworks(state, play_action({ player: 1, index: 0 }));
		state = fireworks(
			state,
			clue_number_action({ cluegiver: 0, player: 1, value: 2 }),
		);
		p1hand = getHandForPlayer(state, 1);
		expect(p1hand[0].cluedNumber).to.equal(2);
		const inference = state.hgroup.inference[1].cards["G2"];
		expect(inference.play).to.equal("now");
		expect(inference.save).to.equal(false);
		expect(inference.possible.length).to.equal(2);
		expect(inference.possible[0]).to.equal("B2");
		expect(inference.possible[1]).to.equal("G2");
	});
	it("Can infer deferred color play clues", () => {
		let state = initialState;
		state = fireworks(state, join_action(p0));
		state = fireworks(state, join_action(p1));
		const p0cards = ["B1", "Y4", "B2", "Y3", "W5"];
		const p1cards = ["B3", "W1", "Y2", "G1", "W3"];
		const deck = [...p0cards, ...p1cards, "Y5"];
		state = fireworks(
			state,
			start_action({
				players: [p0, p1],
				deck,
			}),
		);
		state = fireworks(state, play_action({ player: 0, index: 0 }));

		state = fireworks(
			state,
			clue_color_action({ cluegiver: 1, player: 0, color: "B" }),
		);

		state = fireworks(
			state,
			clue_color_action({ cluegiver: 0, player: 1, color: "B" }),
		);
		let p1hand = getHandForPlayer(state, 1);
		expect(p1hand[0].cluedColor).to.equal("B");
		const inference = state.hgroup.inference[1].cards["B3"];
		expect(inference.play).to.equal("later");
		expect(inference.save).to.equal(false);
		expect(inference.possible.length).to.equal(1);
		expect(inference.possible[0]).to.equal("B3");
	});
	it("Can infer deferred color play clues to own hand", () => {
		let state = initialState;
		state = fireworks(state, join_action(p0));
		state = fireworks(state, join_action(p1));
		const p0cards = ["Y5", "Y4", "B5", "Y3", "W5"];
		const p1cards = ["Y4", "W1", "B1", "G1", "W3"];
		const deck = [...p0cards, ...p1cards, "B2"];
		state = fireworks(
			state,
			start_action({
				players: [p0, p1],
				deck,
			}),
		);
		state = fireworks(
			state,
			clue_color_action({ cluegiver: 0, player: 1, color: "B" }),
		);
		state = fireworks(state, discard_action({ player: 1, index: 4 }));
		state = fireworks(
			state,
			clue_color_action({ cluegiver: 0, player: 1, color: "B" }),
		);
		// P1 Hand should be B2, Y4, W1, B1, G1
		let p1hand = getHandForPlayer(state, 1);
		expect(p1hand[0].cluedColor).to.equal("B");
		expect(p1hand[3].cluedColor).to.equal("B");
		let inference = state.hgroup.inference[1].cards["B1"];
		expect(inference.play).to.equal("now");
		expect(inference.save).to.equal(false);
		expect(inference.possible.length).to.equal(1);
		expect(inference.possible[0]).to.equal("B1");
		inference = state.hgroup.inference[1].cards["B2"];
		expect(inference.play).to.equal("later");
		expect(inference.save).to.equal(false);
		expect(inference.possible.length).to.equal(1);
		expect(inference.possible[0]).to.equal("B2");
	});
	it("Can infer basic number clues excluding seen cards", () => {
		let state = initialState;
		state = fireworks(state, join_action(p0));
		state = fireworks(state, join_action(p1));
		const p0cards = ["B1", "W1", "B2", "G5", "B2-dup"];
		const p1cards = ["G1", "B4", "R1", "B3", "Y4"];
		const deck = [...p0cards, ...p1cards, "Y3", "G2"];
		state = fireworks(
			state,
			start_action({
				players: [p0, p1],
				deck,
			}),
		);
		let p1hand = getHandForPlayer(state, 0);
		state = fireworks(state, play_action({ player: 0, index: 0 }));
		state = fireworks(state, play_action({ player: 1, index: 0 }));
		state = fireworks(
			state,
			clue_number_action({ cluegiver: 0, player: 1, value: 2 }),
		);
		p1hand = getHandForPlayer(state, 1);
		expect(p1hand[0].cluedNumber).to.equal(2);
		const inference = state.hgroup.inference[1].cards["G2"];
		expect(inference.play).to.equal("now");
		expect(inference.save).to.equal(false);
		expect(inference.possible.length).to.equal(1);
		expect(inference.possible[0]).to.equal("G2");
	});
	it("Can construct an arbitrary state", () => {
		const piles = ["R5", "G2", "B1", "Y2"];
		const hands = [
			["R4", "Y2", "Y5", "R3", "B3"],
			["R4", "Y2", "Y5", "R3", "B3"],
			["R4", "Y2", "Y5", "R3", "B3"],
		];
		const turn = 0;
		const deck = ["W5", "Y1"];
		let state = setupState({ piles, hands, deck, turn });
		for (let pile of piles) {
			const topCard = state.piles[pile[0]][state.piles[pile[0]].length - 1];
			expect(topCard.substring(0, 2)).to.equal(pile);
		}
		for (let i = 0; i < hands.length; ++i) {
			const hand = getHandForPlayer(state, i).map((info) => info.name);
			expect(JSON.stringify(hands[i])).to.equal(JSON.stringify(hand));
		}
		expect(state.turn).to.equal(turn);
	});
	it("Tracks possibilities for saves or plays on chop focus number clues", () => {
		let state = setupState({
			piles: ["R1", "Y1", "W3"],
			hands: [
				["Y1", "Y2", "B4", "Y4", "G4-discard"],
				["Y1", "Y2", "Y3", "Y4", "Y5"],
				["R1", "W4", "W3", "R1", "G4-protect"],
			],
			deck: ["B2", "B4"],
			turn: 0,
		});
		expect(state.turn).to.equal(0);
		state = { ...state, clues: 4 };
		// Discard G4
		state = fireworks(
			state,
			discard_action({
				player: 0,
				index: 4,
			}),
		);
		expect(state.discard.length).to.equal(1);
		expect(state.discard[0]).to.equal("G4-discard");
		// Protect clue
		state = fireworks(
			state,
			clue_number_action({
				cluegiver: 1,
				player: 2,
				value: 4,
			}),
		);
		// Player 2 should assume this could be a protected G4.
		expect(state.hgroup.focus[2]).to.equal("G4-protect");
		const inferred = state.hgroup.inference[2].cards["G4-protect"];
		expect(inferred.save).to.equal(true);
		expect(JSON.stringify(inferred.possible.slice().sort())).to.equal(
			JSON.stringify(["G4", "W4"].sort()),
		);
	});
	it("Tracks possibilities for saves or plays on chop focus color clues", () => {
		let state = setupState({
			piles: ["R1", "Y1", "W3"],
			hands: [
				["Y1", "Y2", "Y3", "Y4", "G4-discard"],
				["Y1", "Y2", "Y3", "Y4", "Y5"],
				["R1", "W4", "W3", "R1", "G4-protect"],
			],
			deck: ["B2", "G1"],
			turn: 0,
		});
		expect(state.turn).to.equal(0);
		state = { ...state, clues: 4 };
		// Discard G4
		state = fireworks(
			state,
			discard_action({
				player: 0,
				index: 4,
			}),
		);
		expect(state.discard.length).to.equal(1);
		expect(state.discard[0]).to.equal("G4-discard");
		// Protect clue
		state = fireworks(
			state,
			clue_color_action({
				cluegiver: 1,
				player: 2,
				color: "G",
			}),
		);
		// Player 2 should assume this could be a protected G4.
		expect(state.hgroup.focus[2]).to.equal("G4-protect");
		const inferred = state.hgroup.inference[2].cards["G4-protect"];
		expect(inferred.save).to.equal(true);
		expect(JSON.stringify(inferred.possible.slice().sort())).to.equal(
			JSON.stringify(["G4", "G1"].sort()),
		);
	});
	it("Only considers save possibilities for needed cards", () => {
		let state = setupState({
			piles: ["R1", "Y1", "W3", "G4"],
			hands: [
				["Y1", "Y2", "Y3", "Y4", "G4-discard"],
				["Y1", "Y2", "Y3", "Y4", "Y5"],
				["R1", "W4", "W3", "R1", "G4-protect"],
			],
			deck: ["B2"],
			turn: 0,
		});
		expect(state.turn).to.equal(0);
		state = { ...state, clues: 4 };
		// Discard G4
		state = fireworks(
			state,
			discard_action({
				player: 0,
				index: 4,
			}),
		);
		expect(state.discard.length).to.equal(1);
		expect(state.discard[0]).to.equal("G4-discard");
		// Protect clue
		state = fireworks(
			state,
			clue_number_action({
				cluegiver: 1,
				player: 2,
				value: 4,
			}),
		);
		// Player 2 should assume this could be a protected G4.
		expect(state.hgroup.focus[2]).to.equal("G4-protect");
		const inferred = state.hgroup.inference[2].cards["G4-protect"];
		expect(inferred.save).to.equal(true);
		expect(JSON.stringify(inferred.possible.slice().sort())).to.equal(
			JSON.stringify(["W4"].sort()),
		);
	});
	it("Tracks possibilities for saves or plays on chop focus 2 clues", () => {
		let state = setupState({
			piles: ["G2", "Y1"],
			hands: [
				["Y1", "Y2", "Y3", "Y4", "Y5"],
				["R1", "W4", "W3", "R1", "B2-protect"],
			],
			deck: ["B2", "B4", "Y2", "R2", "R2", "W2", "W2"],
			turn: 0,
		});
		expect(state.turn).to.equal(0);
		// Protect clue
		state = fireworks(
			state,
			clue_number_action({
				cluegiver: 0,
				player: 1,
				value: 2,
			}),
		);
		// Player 2 should assume this could be saving a 2 for later.
		expect(state.hgroup.focus[1]).to.equal("B2-protect");
		const inferred = state.hgroup.inference[1].cards["B2-protect"];
		expect(inferred.save).to.equal(true);
		expect(JSON.stringify(inferred.possible.slice().sort())).to.equal(
			JSON.stringify(["B2", "R2", "W2", "Y2"].sort()),
		);
	});
});
