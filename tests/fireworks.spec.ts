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
} from "$lib/components/fireworks";

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
});
